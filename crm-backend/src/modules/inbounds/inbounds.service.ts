import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inbound } from '../../database/entities/inbound.entity';
import { InboundFollowUp } from '../../database/entities/inbound-follow-up.entity';
import { InboundContactLog } from '../../database/entities/inbound-contact-log.entity';
import { S3Client } from 'bun';
import { extname } from 'path';

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
    const inbound = await this.findOne(id);

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Image size exceeds 5MB limit');
    }

    const fileExt = extname(file.originalname);
    const tempFileKey = `inbounds/${inbound.property_id}/temp_${Date.now()}${fileExt}`;

    await this.s3Client.write(tempFileKey, file.buffer, {
      type: file.mimetype,
    });

    const tempFileUrl = `${process.env.R2_PUBLIC_URL}/${tempFileKey}`;

    // Process image via Imgproxy (WebP + Watermark)
    try {
      const imgproxyUrl = `http://imgproxy:8080/insecure/watermark:1:ce:0:0:0.3/format:webp/plain/${tempFileUrl}`;
      const response = await fetch(imgproxyUrl);
      
      if (!response.ok) {
        throw new Error(`Imgproxy failed with status ${response.status}`);
      }
      
      const processedBuffer = await response.arrayBuffer();
      const finalFileKey = `inbounds/${inbound.property_id}/image_${Date.now()}.webp`;
      
      await this.s3Client.write(finalFileKey, Buffer.from(processedBuffer), { type: 'image/webp' });
      
      // Cleanup temp file
      this.s3Client.delete(tempFileKey).catch(() => {});

      inbound.image_url = `${process.env.R2_PUBLIC_URL}/${finalFileKey}`;
    } catch (e) {
      console.error('Imgproxy processing failed, using original:', e);
      inbound.image_url = tempFileUrl;
    }
    
    return this.inboundsRepository.save(inbound);
  }

  async create(createInboundDto: Partial<Inbound>): Promise<Inbound> {
    const newInbound = this.inboundsRepository.create(createInboundDto);
    
    // Save to get the auto-incremented ID
    let savedInbound = await this.inboundsRepository.save(newInbound);
    
    // Generate property_id: I + 5-digit padded id (e.g., I00001)
    const paddedId = savedInbound.id.toString().padStart(5, '0');
    savedInbound.property_id = `I${paddedId}`;
    
    // Save again with the property_id
    savedInbound = await this.inboundsRepository.save(savedInbound);
    
    return savedInbound;
  }

  async findAll(): Promise<any[]> {
    const inbounds = await this.inboundsRepository.find({
      relations: { follow_ups: true },
      order: { created_at: 'DESC' }
    });

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
        ...inbound,
        nextFollowUpDate,
        lastFollowedUpDate
      };
    });
  }

  async findOne(id: number): Promise<Inbound> {
    const inbound = await this.inboundsRepository.findOne({
      where: { id },
      relations: {
        follow_ups: true,
        contact_logs: {
          sent_by: true
        }
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
    return inbound;
  }

  async update(id: number, updateInboundDto: Partial<Inbound>): Promise<Inbound> {
    const inbound = await this.findOne(id);
    
    // update properties (TypeORM hooks will trigger on save)
    Object.assign(inbound, updateInboundDto);
    
    return this.inboundsRepository.save(inbound);
  }

  
  async addContactLog(inboundId: number, payload: Partial<InboundContactLog>, userId: number): Promise<InboundContactLog> {
    const inbound = await this.findOne(inboundId);
    
    const contactLog = this.contactLogsRepository.create({
      ...payload,
      inbound_id: inboundId,
      sent_by_id: userId,
    });
    
    return this.contactLogsRepository.save(contactLog);
  }

  async addFollowUp(inboundId: number, payload: Partial<InboundFollowUp>, userId: number): Promise<InboundFollowUp> {
    const inbound = await this.findOne(inboundId);
    
    const followUp = this.followUpsRepository.create({
      ...payload,
      inbound_id: inboundId,
      created_by_id: userId,
    });
    
    return this.followUpsRepository.save(followUp);
  }

  async updateFollowUp(inboundId: number, followUpId: number, payload: Partial<InboundFollowUp>): Promise<InboundFollowUp> {
    const followUp = await this.followUpsRepository.findOne({
      where: { id: followUpId, inbound_id: inboundId }
    });
    
    if (!followUp) {
      throw new NotFoundException(`Follow-up with ID ${followUpId} not found`);
    }
    
    Object.assign(followUp, payload);
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
    const inbound = await this.findOne(id);
    await this.inboundsRepository.remove(inbound);
  }
}
