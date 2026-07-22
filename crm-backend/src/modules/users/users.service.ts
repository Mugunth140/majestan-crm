import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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

  async findAll() {
    return this.userRepository.find({
      relations: { role: true, department: true },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: { role: true, department: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
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
    });
    return this.userRepository.save(user);
  }

  async update(id: number, body: any) {
    const user = await this.findOne(id);

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

    return this.userRepository.save(user);
  }

  async delete(id: number) {
    const user = await this.findOne(id);
    user.is_active = false; // Soft delete / disable
    return this.userRepository.save(user);
  }
}
