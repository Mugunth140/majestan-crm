import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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

    const hashedPassword = await bcrypt.hash(body.password, 10);
    const user = this.userRepository.create({
      name: body.name,
      email: body.email,
      password_hash: hashedPassword,
      role_id: body.role_id,
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

    user.name = body.name ?? user.name;
    user.email = body.email ?? user.email;
    user.role_id = body.role_id ?? user.role_id;
    user.is_active = body.is_active ?? user.is_active;

    return this.userRepository.save(user);
  }

  async delete(id: number) {
    const user = await this.findOne(id);
    user.is_active = false; // Soft delete / disable
    return this.userRepository.save(user);
  }
}
