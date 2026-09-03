
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../../database/entities/permission.entity';
import { UserPermission } from '../../database/entities/user-permission.entity';
import { User } from '../../database/entities/user.entity';

export const VIEW_PROPERTY_CONTACTS = 'properties.view_contacts';

function isAdminRole(roleName?: string | null): boolean {
  return roleName === 'Admin' || roleName === 'Super Admin';
}

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(UserPermission)
    private readonly userPermissionRepo: Repository<UserPermission>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  findAll() {
    return this.permissionRepo.find({ order: { module: 'ASC', name: 'ASC' } });
  }

  async listUserPermissions(userId: number): Promise<string[]> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { role: true },
    });
    if (!user) return [];
    if (isAdminRole(user.role?.name)) {
      // Admin bypass: sees everything without explicit rows
      const all = await this.permissionRepo.find();
      return all.map((p) => p.name);
    }
    const rows = await this.userPermissionRepo.find({
      where: { user_id: userId },
      relations: { permission: true },
    });
    return rows.map((r) => r.permission?.name).filter(Boolean);
  }

  async hasPermission(userId: number, key: string): Promise<boolean> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { role: true },
    });
    if (!user) return false;
    if (isAdminRole(user.role?.name)) return true;
    const count = await this.userPermissionRepo
      .createQueryBuilder('up')
      .innerJoin(Permission, 'p', 'p.id = up.permission_id AND p.name = :key', { key })
      .where('up.user_id = :userId', { userId })
      .getCount();
    return count > 0;
  }

  /** Replace a user's grants. Caller must have verified Admin role. */
  async setUserPermissions(userId: number, keys: string[]): Promise<string[]> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const perms = keys.length > 0
      ? await this.permissionRepo.createQueryBuilder('p').where('p.name IN (:...keys)', { keys }).getMany()
      : [];
    await this.userPermissionRepo.delete({ user_id: userId });
    if (perms.length > 0) {
      await this.userPermissionRepo.save(
        perms.map((p) => this.userPermissionRepo.create({ user_id: userId, permission_id: p.id })),
      );
    }
    return this.listUserPermissions(userId);
  }
}
