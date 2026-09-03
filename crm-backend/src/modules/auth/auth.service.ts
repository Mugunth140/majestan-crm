import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../../database/entities/user.entity';
import { Permission } from '../../database/entities/permission.entity';
import { UserPermission } from '../../database/entities/user-permission.entity';

function isAdminRole(roleName?: string | null): boolean {
  return roleName === 'Admin' || roleName === 'Super Admin';
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(UserPermission)
    private readonly userPermissionRepo: Repository<UserPermission>,
    private readonly jwtService: JwtService,
  ) {}

  private async permissionKeys(user: User): Promise<string[]> {
    const roleName = user.role?.name;
    if (isAdminRole(roleName)) {
      const all = await this.permissionRepo.find();
      return all.map((p) => p.name);
    }
    const rows = await this.userPermissionRepo.find({
      where: { user_id: user.id },
      relations: { permission: true },
    });
    return rows.map((r) => r.permission?.name).filter(Boolean) as string[];
  }

  async login(email: string, pass: string) {
    const user = await this.userRepository.findOne({ 
      where: { email },
      relations: { role: true, department: true } 
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account disabled');
    }

    const isMatch = await bcrypt.compare(pass, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const permissions = await this.permissionKeys(user);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role?.name || 'Staff',
      department_id: user.department_id,
      permissions
    };

    return {
      success: true,
      message: 'Login successful',
      data: {
        access_token: this.jwtService.sign(payload),
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role?.name,
          department_id: user.department_id,
          department: user.department?.name,
          permissions
        }
      }
    };
  }

  async getMe(userId: number) {
    const user = await this.userRepository.findOne({ 
      where: { id: userId },
      relations: { role: true, department: true } 
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const permissions = await this.permissionKeys(user);

    return {
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role?.name,
        department_id: user.department_id,
        department: user.department?.name,
        device_last_sync_at: user.device_last_sync_at,
        permissions
      }
    };
  }
}
