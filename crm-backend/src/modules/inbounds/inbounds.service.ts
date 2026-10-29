import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { In, Repository } from 'typeorm';
import { Inbound } from '../../database/entities/inbound.entity';
import { InboundFollowUp } from '../../database/entities/inbound-follow-up.entity';
import { InboundContactLog } from '../../database/entities/inbound-contact-log.entity';
import { InboundUnit } from '../../database/entities/inbound-unit.entity';
import { PermissionsService } from '../permissions/permissions.service';
import { S3Client } from 'bun';
import { extname } from 'path';
import { readInboundPhotoCoordinates, submissionStatuses } from './inbound-submissions';
import { buildWatermarkedImageUrl } from '../../common/imgproxy-watermark';

// Sensitive contact values masked for Team Lead / Staff without the
// `inbounds.call_tracking` grant. Names, roles and the property address stay
// visible — only reachable phone/email values are hidden.
const INBOUND_CONTACT_KEYS = [
  'mobile_number',
  'whatsapp_number',
  'email',
  'alternate_contact',
  'alternative_contact',
  'primary_contact_number',
  'key_contact_number',
  'manager_mobile',
  'caretaker_mobile',
  'security_contact',
  'broker_mobile',
] as const;

@Injectable()
export class InboundsService {
  private _s3Client: S3Client | null = null;

  constructor(
    @InjectRepository(Inbound)
    private inboundsRepository: Repository<Inbound>,
    @InjectRepository(InboundFollowUp)
    private followUpsRepository: Repository<InboundFollowUp>,
    @InjectRepository(InboundContactLog)
    private contactLogsRepository: Repository<InboundContactLog>,
    @InjectRepository(InboundUnit)
    private unitsRepository: Repository<InboundUnit>,
    private readonly permissionsService: PermissionsService,
    @Optional() private readonly events?: EventEmitter2,
  ) {}

  private get s3Client(): S3Client {
    if (!this._s3Client) {
      this._s3Client = new S3Client({
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        bucket: process.env.R2_BUCKET_NAME || '',
        region: 'auto',
      });
    }
    return this._s3Client;
  }

  async uploadImage(id: number, file: Express.Multer.File) {
    const inbound = await this.mustFindOne(id);

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Image size exceeds 10MB limit');
    }

    // Read the original buffer before imgproxy removes image metadata.
    const coordinates = await readInboundPhotoCoordinates(file.buffer);
    const fileExt = extname(file.originalname);
    const tempFileKey = `inbounds/${inbound.property_id}/temp_${Date.now()}${fileExt}`;

    const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          promise,
          new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error('S3 Operation Timed Out')), ms); }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    await withTimeout(this.s3Client.write(tempFileKey, file.buffer, {
      type: file.mimetype,
    }), 15000);

    const tempFileUrl = `${process.env.R2_PUBLIC_URL}/${tempFileKey}`;

    // Process image via Imgproxy (WebP + Watermark, shared faint opacity)
    try {
      const imgproxyUrl = buildWatermarkedImageUrl(tempFileUrl, 0.2, 80);
      const response = await fetch(imgproxyUrl, {
        signal: AbortSignal.timeout(15000)
      });
      
      if (!response.ok) {
        throw new Error(`Imgproxy failed with status ${response.status}`);
      }
      
      const processedBuffer = await response.arrayBuffer();
      const finalFileKey = `inbounds/${inbound.property_id}/image_${Date.now()}.webp`;
      
      await withTimeout(this.s3Client.write(finalFileKey, Buffer.from(processedBuffer), { type: 'image/webp' }), 15000);
      
      // Cleanup temp file
      this.s3Client.delete(tempFileKey).catch(() => {});

      inbound.image_url = `${process.env.R2_PUBLIC_URL}/${finalFileKey}`;
    } catch (e) {
      console.error('Imgproxy processing failed, using original:', e);
      inbound.image_url = tempFileUrl;
    }
    
    // Serialize the final image save with late GPS updates, including after an app reload.
    return this.inboundsRepository.manager.transaction(async manager => {
      const current = await manager.findOne(Inbound, {
        where: { id }, lock: { mode: 'pessimistic_write' },
      });
      if (!current) throw new NotFoundException(`Inbound with ID ${id} not found`);
      current.image_url = inbound.image_url;
      if (coordinates) {
        current.latitude = coordinates.latitude;
        current.longitude = coordinates.longitude;
        current.google_map_location = '';
      }
      return manager.save(Inbound, current);
    });
  }

  /** Keep only rows with a floor label; coerce price to number-or-undefined. */
  private sanitizeUnits(units: any): Array<{ floor_label: string; area?: string; price?: number; notes?: string }> {
    if (!Array.isArray(units)) return [];
    return units
      .filter((u) => u && String(u.floor_label ?? '').trim() !== '')
      .map((u) => {
        const rawPrice = u.price == null || u.price === '' ? undefined : Number(u.price);
        return {
          floor_label: String(u.floor_label).trim(),
          area: u.area != null && String(u.area).trim() !== '' ? String(u.area).trim() : undefined,
          price: rawPrice !== undefined && Number.isFinite(rawPrice) ? rawPrice : undefined,
          notes: u.notes != null && String(u.notes).trim() !== '' ? String(u.notes).trim() : undefined,
        };
      });
  }

  async create(createInboundDto: Omit<Partial<Inbound>, 'units'> & { units?: any[] }, actorId: number | null = null): Promise<Inbound> {
    const { units, quick_capture, uploaded_by_id: _uploader, is_queued: _queued, ...rest } = createInboundDto as typeof createInboundDto & { quick_capture?: boolean };
    if (quick_capture) {
      rest.assigned_staff_id = null as any;
      if (!rest.property_type) throw new BadRequestException('Select a property type');
    }
    const newInbound = this.inboundsRepository.create({ ...rest, uploaded_by_id: actorId, is_queued: !!quick_capture });
    
    // Save to get the auto-incremented ID
    let savedInbound = await this.inboundsRepository.save(newInbound);
    
    // Generate property_id: I + 5-digit padded id (e.g., I00001)
    const paddedId = savedInbound.id.toString().padStart(5, '0');
    savedInbound.property_id = `I${paddedId}`;
    
    // Save again with the property_id
    savedInbound = await this.inboundsRepository.save(savedInbound);

    const cleanUnits = this.sanitizeUnits(units);
    if (cleanUnits.length > 0) {
      const rows = cleanUnits.map((u) =>
        this.unitsRepository.create({ ...u, inbound_id: savedInbound.id }),
      );
      (savedInbound as any).units = await this.unitsRepository.save(rows);
    } else {
      (savedInbound as any).units = [];
    }

    // listings@ "property received" draft (only reaches owners with an email).
    await this.events?.emitAsync('listings.inbound.created', { entityId: savedInbound.id, actorId });
    return savedInbound;
  }

  private stripContacts<T extends Record<string, any>>(record: T): T {
    const copy: Record<string, any> = { ...record };
    for (const k of INBOUND_CONTACT_KEYS) delete copy[k];
    return copy as T;
  }

  private async canSeeContacts(reqUser?: any): Promise<boolean> {
    // req.user carries { id, role } where role is the role name string.
    // Admin / Super Admin / Manager see everything by default; Team Lead /
    // Staff need the explicit `inbounds.call_tracking` grant.
    const role: string = reqUser?.role?.name || reqUser?.role || '';
    if (role === 'Admin' || role === 'Super Admin' || role === 'Manager') return true;
    const userId = Number(reqUser?.id);
    if (!Number.isFinite(userId)) return false;
    return this.permissionsService.hasInboundTrackingAccess(userId);
  }

  private userRepository() { return this.inboundsRepository.manager.getRepository(User); }

  async canManageQueue(user?: any): Promise<boolean> {
    if (['Admin', 'Super Admin', 'Manager'].includes(user?.role?.name || user?.role)) return true;
    if (!user?.id) return false;
    const person = await this.userRepository().findOne({ where: { id: Number(user.id), is_active: true }, relations: { department: true } });
    return !!person?.department?.name?.toLowerCase().replace(/[^a-z]/g, '').startsWith('inbound');
  }

  async assignableStaff() {
    const people = await this.userRepository().find({ where: { is_active: true }, relations: { department: true },
      select: { id: true, name: true, department: { id: true, name: true } }, order: { name: 'ASC' } });
    return people.filter(person => person.department?.name?.toLowerCase().replace(/[^a-z]/g, '').startsWith('inbound'))
      .map(person => ({ id: person.id, name: person.name }));
  }

  async assign(ids: number[], staffId: number | null, actor: any) {
    if (!(await this.canManageQueue(actor))) throw new ForbiddenException('Only inbound staff and managers can assign inbounds');
    if (staffId !== null && !(await this.assignableStaff()).some(person => person.id === staffId)) {
      throw new BadRequestException('Choose an active inbound staff member');
    }
    const records = await this.inboundsRepository.find({ where: { id: In(ids) }, select: { id: true } });
    if (records.length !== ids.length) throw new NotFoundException('One or more inbounds were not found');
    await this.inboundsRepository.update({ id: In(ids) }, { assigned_staff_id: staffId as any, is_queued: staffId === null });
    return { success: true, assigned: ids.length };
  }

  async updateAuthorized(id: number, data: any, actor: any) {
    if (data.assigned_staff_id !== undefined) {
      const current = await this.mustFindOne(id);
      if (current.assigned_staff_id !== data.assigned_staff_id) {
        throw new BadRequestException('Use Assign to change the assigned staff member');
      }
    }
    return this.update(id, data, actor?.id ?? null);
  }

  async findAll(user?: any): Promise<any[]> {
    let whereClause: any = {};
    if (user && user.role === 'Staff') {
      whereClause.assigned_staff_id = user.id;
    } else if (user && user.role === 'Team Lead') {
      whereClause.assigned_staff = { department_id: user.department_id };
    }

    if (user && ['Staff', 'Team Lead'].includes(user.role)) {
      whereClause = [whereClause, { uploaded_by_id: user.id },
        ...((await this.canManageQueue(user)) ? [{ is_queued: true }] : [])];
    }

    const inbounds = await this.inboundsRepository.find({
      where: whereClause,
      relations: { follow_ups: true },
      order: { created_at: 'DESC', id: 'DESC' }
    });

    const contactHistory = await this.inboundsRepository.find({
      select: { id: true, mobile_number: true },
    });
    const personIds = [...new Set(inbounds.flatMap(record => [record.uploaded_by_id, record.assigned_staff_id]).filter((id): id is number => !!id))];
    const people = personIds.length ? await this.userRepository().find({ where: { id: In(personIds) }, select: { id: true, name: true } }) : [];
    const names = new Map(people.map(person => [person.id, { id: person.id, name: person.name }]));
    const statuses = submissionStatuses(contactHistory);
    const canSee = await this.canSeeContacts(user);
    return inbounds.map(inbound => {
      let nextFollowUpDate = null;
      let lastFollowedUpDate = null;
      
      if (inbound.follow_ups && inbound.follow_ups.length > 0) {
        // Find latest scheduled follow-up
        const scheduledFus = [...inbound.follow_ups].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        nextFollowUpDate = scheduledFus.length > 0 ? scheduledFus[0].next_follow_up_date : null;

        // Find latest actual follow up (where follow_up_date is set)
        const actualFus = [...inbound.follow_ups]
          .filter(f => f.follow_up_date)
          .sort((a, b) => new Date(b.follow_up_date!).getTime() - new Date(a.follow_up_date!).getTime());
        
        lastFollowedUpDate = actualFus.length > 0 ? actualFus[0].follow_up_date : null;
      }

      return {
        ...(canSee ? inbound : this.stripContacts(inbound)),
        uploaded_by: names.get(inbound.uploaded_by_id!) || null,
        assigned: names.get(inbound.assigned_staff_id) || null,
        submission_status: statuses.get(inbound.id) || 'New',
        nextFollowUpDate,
        lastFollowedUpDate
      };
    });
  }

  async findOne(id: number, user?: any): Promise<Inbound> {
    const inbound = await this.mustFindOne(id);

    if (user && user.role === 'Staff' && inbound.assigned_staff_id !== user.id && inbound.uploaded_by_id !== user.id && !(inbound.is_queued && await this.canManageQueue(user))) {
      throw new NotFoundException(`Inbound with ID ${id} not found`);
    }

    const canSee = await this.canSeeContacts(user);
    return canSee ? inbound : this.stripContacts(inbound);
  }

  /** Internal fetch without contact masking (for update/remove/logging flows). */
  private async mustFindOne(id: number): Promise<Inbound> {
    const inbound = await this.inboundsRepository.findOne({
      where: { id },
      relations: {
        follow_ups: true,
        contact_logs: {
          sent_by: true
        },
        units: true
      },
      order: {
        follow_ups: {
          created_at: 'DESC'
        },
        contact_logs: {
          created_at: 'DESC'
        }
      }
    });
    if (!inbound) {
      throw new NotFoundException(`Inbound with ID ${id} not found`);
    }
    // OneToMany collections can't be ordered in find() — keep floors stable.
    if (Array.isArray((inbound as any).units)) {
      (inbound as any).units.sort((a: any, b: any) => (a.id ?? 0) - (b.id ?? 0));
    }

    return inbound;
  }

  async saveLocationIfMissing(id: number, coordinates: { latitude: number; longitude: number }, user?: any) {
    await this.findOne(id, user);
    // Atomic fallback: a delayed device fix must never replace photo GPS or staff edits.
    const result = await this.inboundsRepository.createQueryBuilder()
      .update(Inbound)
      .set({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        quality_score: () => "LEAST(100, quality_score + IF(google_map_location IS NULL OR google_map_location = '', 10, 0))",
      })
      .where('id = :id', { id })
      .andWhere('(latitude IS NULL OR longitude IS NULL)')
      .execute();
    return { saved: result.affected === 1 };
  }

  async update(id: number, updateInboundDto: Omit<Partial<Inbound>, 'units'> & { units?: any[] }, actorId: number | null = null): Promise<Inbound> {
    const inbound = await this.mustFindOne(id);
    const previousStatus = inbound.status;

    const { units, uploaded_by_id: _uploader, is_queued: _queued, quick_capture: _quick, ...rest } = updateInboundDto as typeof updateInboundDto & { quick_capture?: boolean };
    // update properties (TypeORM hooks will trigger on save)
    Object.assign(inbound, rest);

    const saved = await this.inboundsRepository.save(inbound);
    if (saved.status !== previousStatus) {
      await this.events?.emitAsync('listings.inbound.status_changed', { entityId: id, actorId, from: previousStatus, to: saved.status });
    }

    // Full replace when the form sends its floor rows (omitted = untouched).
    if (units !== undefined) {
      await this.unitsRepository.delete({ inbound_id: id });
      const cleanUnits = this.sanitizeUnits(units);
      (saved as any).units = cleanUnits.length > 0
        ? await this.unitsRepository.save(
            cleanUnits.map((u) => this.unitsRepository.create({ ...u, inbound_id: id })),
          )
        : [];
      return saved;
    }

    (saved as any).units = await this.unitsRepository.find({
      where: { inbound_id: id },
      order: { id: 'ASC' },
    });
    return saved;
  }

  
  async addContactLog(inboundId: number, payload: Partial<InboundContactLog>, userId: number): Promise<InboundContactLog> {
    const inbound = await this.mustFindOne(inboundId);
    
    const contactLog = this.contactLogsRepository.create({
      ...payload,
      inbound_id: inboundId,
      sent_by_id: userId,
    });
    
    return this.contactLogsRepository.save(contactLog);
  }

  async addFollowUp(inboundId: number, body: any, userId: number): Promise<InboundFollowUp> {
    const inbound = await this.mustFindOne(inboundId);
    
    const followUp = this.followUpsRepository.create({
      inbound_id: inboundId,
      created_by_id: userId,
      follow_up_date: body.followUpDate || null,
      follow_up_time: body.followUpTime || null,
      contacted_via: body.contactedVia || null,
      next_follow_up_date: body.nextFollowUpDate || null,
      next_follow_up_time: body.nextFollowUpTime || null,
      purpose: body.purpose || null,
      priority: body.priority || null,
      rnr: body.rnr || null,
      notes: body.notes || null,
    });
    
    return this.followUpsRepository.save(followUp);
  }

  async updateFollowUp(inboundId: number, followUpId: number, body: any): Promise<InboundFollowUp> {
    const followUp = await this.followUpsRepository.findOne({
      where: { id: followUpId, inbound_id: inboundId }
    });
    
    if (!followUp) {
      throw new NotFoundException(`Follow-up with ID ${followUpId} not found`);
    }
    
    if (body.followUpDate !== undefined) followUp.follow_up_date = body.followUpDate;
    if (body.followUpTime !== undefined) followUp.follow_up_time = body.followUpTime;
    if (body.contactedVia !== undefined) followUp.contacted_via = body.contactedVia;
    if (body.nextFollowUpDate !== undefined) followUp.next_follow_up_date = body.nextFollowUpDate;
    if (body.nextFollowUpTime !== undefined) followUp.next_follow_up_time = body.nextFollowUpTime;
    if (body.purpose !== undefined) followUp.purpose = body.purpose;
    if (body.priority !== undefined) followUp.priority = body.priority;
    if (body.rnr !== undefined) followUp.rnr = body.rnr;
    if (body.notes !== undefined) followUp.notes = body.notes;

    return this.followUpsRepository.save(followUp);
  }

  async deleteFollowUp(inboundId: number, followUpId: number): Promise<void> {
    const followUp = await this.followUpsRepository.findOne({
      where: { id: followUpId, inbound_id: inboundId }
    });
    
    if (!followUp) {
      throw new NotFoundException(`Follow-up with ID ${followUpId} not found`);
    }
    
    await this.followUpsRepository.remove(followUp);
  }

  async remove(id: number): Promise<void> {
    const inbound = await this.mustFindOne(id);
    await this.inboundsRepository.remove(inbound);
  }
}
