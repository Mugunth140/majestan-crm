import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { User, fullUser } from '../../database/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { PermissionsService } from '../permissions/permissions.service';
import { ContactLogsService } from '../contact-logs/contact-logs.service';
import { UserAvatarsService } from './user-avatars.service';
import { cleanNavAccess } from './nav-access';
import type { SelfUpdateDto } from './dto/self-update.dto';
import { gettingStarted } from './getting-started';
import { isPreset, presetUrl } from './avatar-presets';

const ONBOARDING_KEYS = new Set(['welcomed_at', 'checklist_dismissed_at', 'last_seen_version']);

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly permissionsService: PermissionsService,
    private readonly contactLogsService: ContactLogsService,
    private readonly avatars: UserAvatarsService,
  ) {}

  private validateRoleDepartment(roleId: number, departmentId: number | null): number | null {
    // 1 = Admin, 2 = Manager, 3 = Team Lead, 4 = Staff
    if (roleId === 1 || roleId === 2) {
      // Admin and Manager should not be tied to a specific department
      return null;
    }
    if ((roleId === 3 || roleId === 4) && !departmentId) {
      throw new BadRequestException('Department is mandatory for Staff and Team Lead roles');
    }
    return departmentId;
  }

  /**
   * Everyone. Admins get the full records (with permissions) for the Users
   * screens; anyone else gets the public shape only (name, role, team, photo),
   * never phone, address, Aadhaar or bank details.
   */
  async findAll(full = false) {
    const users = await this.userRepository.find({
      relations: { role: true, department: true },
      order: { created_at: 'DESC' },
    });
    if (!full) return users.map((u) => u.toJSON());
    return Promise.all(
      users.map(async (u) => ({
        ...fullUser(u),
        permissions: await this.permissionsService.listUserPermissions(u.id),
      })),
    );
  }

  /** Just id, name and photo for the users who have one: cheap enough for every page. */
  async photos() {
    const users = await this.userRepository.find({ select: { id: true, name: true, avatar_url: true }, where: { avatar_url: Not(IsNull()) } });
    return users.map((u) => ({ id: u.id, name: u.name, avatar_url: u.avatar_url }));
  }

  /** One user: the full record for admins and the user themself, else the public shape. */
  async findOne(id: number, full = true) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: { role: true, department: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!full) return user.toJSON();
    return {
      ...fullUser(user),
      permissions: await this.permissionsService.listUserPermissions(user.id),
    };
  }

  async create(body: any) {
    const existing = await this.userRepository.findOne({ where: { email: body.email } });
    if (existing) throw new ConflictException('Email already exists');

    const validDepartmentId = this.validateRoleDepartment(body.role_id, body.department_id || null);

    const hashedPassword = await bcrypt.hash(body.password, 10);
    const user = this.userRepository.create({
      name: body.name,
      email: body.email,
      password_hash: hashedPassword,
      role_id: body.role_id,
      department_id: validDepartmentId as any,
      address: body.address || null,
      phone: body.phone || null,
      whatsapp_no: body.whatsapp_no || null,
      dob: body.dob || null,
      aadhaar_no: body.aadhaar_no || null,
      bank_account_no: body.bank_account_no || null,
      join_date: body.join_date || null,
      qualification: body.qualification || null,
      is_active: body.is_active ?? true,
      nav_access: cleanNavAccess(body.nav_access),
    });
    const saved = await this.userRepository.save(user);
    if (Array.isArray(body.permissionKeys)) {
      await this.permissionsService.setUserPermissions(saved.id, body.permissionKeys);
    }
    return fullUser(saved);
  }

  /** The stored entity, for changes; findOne is the response shape. */
  private async mustFind(id: number) {
    const user = await this.userRepository.findOne({ where: { id }, relations: { role: true, department: true } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: number, body: any) {
    const user = await this.mustFind(id);

    if (body.email && body.email !== user.email) {
      const existing = await this.userRepository.findOne({ where: { email: body.email } });
      if (existing) throw new ConflictException('Email already exists');
    }

    if (body.password) {
      user.password_hash = await bcrypt.hash(body.password, 10);
    }

    const newRoleId = body.role_id ?? user.role_id;
    const newDeptId = body.department_id !== undefined ? (body.department_id || null) : user.department_id;
    
    const validDepartmentId = this.validateRoleDepartment(newRoleId, newDeptId);

    user.name = body.name ?? user.name;
    user.email = body.email ?? user.email;
    
    // TypeORM relation fix: When updating a loaded entity with relations, 
    // update the relation object directly so it doesn't overwrite the scalar ID during save.
    if (body.role_id !== undefined) {
      user.role_id = body.role_id;
      user.role = { id: body.role_id } as any;
    }
    
    user.department_id = validDepartmentId as any;
    user.department = validDepartmentId ? { id: validDepartmentId } as any : null;
    
    user.address = body.address !== undefined ? (body.address || null) : user.address;
    user.phone = body.phone !== undefined ? (body.phone || null) : user.phone;
    user.whatsapp_no = body.whatsapp_no !== undefined ? (body.whatsapp_no || null) : user.whatsapp_no;
    user.dob = body.dob !== undefined ? (body.dob || null) : user.dob;
    user.aadhaar_no = body.aadhaar_no !== undefined ? (body.aadhaar_no || null) : user.aadhaar_no;
    user.bank_account_no = body.bank_account_no !== undefined ? (body.bank_account_no || null) : user.bank_account_no;
    user.join_date = body.join_date !== undefined ? (body.join_date || null) : user.join_date;
    user.qualification = body.qualification !== undefined ? (body.qualification || null) : user.qualification;
    user.is_active = body.is_active ?? user.is_active;
    if (body.nav_access !== undefined) user.nav_access = cleanNavAccess(body.nav_access);

    const saved = await this.userRepository.save(user);
    if (Array.isArray(body.permissionKeys)) {
      await this.permissionsService.setUserPermissions(saved.id, body.permissionKeys);
    }
    if (body.password) {
      // Password change kills all device sessions — staff re-register on next sign-in.
      await this.contactLogsService.revokeAllUserDevices(saved.id);
    }
    return fullUser(saved);
  }

  /** Someone editing their own details: only the fields in SelfUpdateDto. */
  async updateSelf(id: number, body: SelfUpdateDto) {
    const user = await this.mustFind(id);
    const blank = (v: string | undefined, cur: string) => (v === undefined ? cur : v.trim() || (null as any));
    if (body.name !== undefined && body.name.trim()) user.name = body.name.trim();
    user.phone = blank(body.phone, user.phone);
    user.whatsapp_no = blank(body.whatsapp_no, user.whatsapp_no);
    user.address = blank(body.address, user.address);
    user.dob = blank(body.dob, user.dob);
    user.qualification = blank(body.qualification, user.qualification);
    return fullUser(await this.userRepository.save(user));
  }

  /** Changes a password after checking the current one; signs the user out of their other devices. */
  async changePassword(id: number, current: string, next: string) {
    const user = await this.mustFind(id);
    if (!(await bcrypt.compare(current, user.password_hash))) throw new BadRequestException('Your current password is wrong');
    if (current === next) throw new BadRequestException('Choose a password you have not used here');
    user.password_hash = await bcrypt.hash(next, 10);
    await this.userRepository.save(user);
    await this.contactLogsService.revokeAllUserDevices(id);
  }

  /** First-steps checklist, and whether the person has put it away. */
  async checklist(id: number) {
    const user = await this.mustFind(id);
    const items = await gettingStarted(this.userRepository.manager.connection, id);
    return { items, dismissed: !!(user.onboarding as any)?.checklist_dismissed_at };
  }

  async onboarding(id: number) {
    const user = await this.mustFind(id);
    return user.onboarding ?? {};
  }

  /** Merges top-level keys and per-tour entries; `reset: true` clears everything so the tours run again. */
  async updateOnboarding(id: number, patch: Record<string, unknown>) {
    const user = await this.mustFind(id);
    if (patch.reset === true) {
      user.onboarding = null;
    } else {
      const cur = (user.onboarding ?? {}) as Record<string, any>;
      const { tours, ...rest } = patch as Record<string, any>;
      const clean = Object.fromEntries(Object.entries(rest).filter(([k]) => ONBOARDING_KEYS.has(k)));
      const nextTours = tours && typeof tours === 'object' ? { ...(cur.tours ?? {}), ...tours } : cur.tours;
      user.onboarding = { ...cur, ...clean, ...(nextTours ? { tours: nextTours } : {}) };
    }
    await this.userRepository.save(user);
    return user.onboarding ?? {};
  }

  /** Stores a new profile photo, then removes the old one. */
  async setAvatar(id: number, file: Express.Multer.File) {
    const user = await this.mustFind(id);
    const previous = user.avatar_url;
    const url = await this.avatars.upload(id, file);
    await this.userRepository.update(id, { avatar_url: url });
    await this.avatars.discard(previous).catch(() => {}); // a leftover file is harmless
    return { avatar_url: url };
  }

  /** Switches to one of the ready-made avatars; an uploaded photo it replaces is deleted. */
  async setPresetAvatar(id: number, name: string) {
    if (!isPreset(name)) throw new BadRequestException('Pick one of the avatars shown');
    const user = await this.mustFind(id);
    const url = presetUrl(name);
    await this.userRepository.update(id, { avatar_url: url });
    await this.avatars.discard(user.avatar_url).catch(() => {});
    return { avatar_url: url };
  }

  async removeAvatar(id: number) {
    const user = await this.mustFind(id);
    if (user.avatar_url) {
      await this.userRepository.update(id, { avatar_url: null });
      await this.avatars.discard(user.avatar_url).catch(() => {});
    }
    return { avatar_url: null };
  }

  async delete(id: number) {
    const user = await this.mustFind(id);
    user.is_active = false; // Soft delete / disable
    return fullUser(await this.userRepository.save(user));
  }
}
