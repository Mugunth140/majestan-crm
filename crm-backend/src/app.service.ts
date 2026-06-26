import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role } from './database/entities/role.entity';
import { User } from './database/entities/user.entity';
import { LeadStatus } from './database/entities/lead-status.entity';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);

  constructor(@InjectDataSource() private dataSource: DataSource) {}

  async onModuleInit() {
    try {
      await this.seedRolesAndAdmin();
      await this.seedLeadStatuses();
    } catch (e) {
      this.logger.error('Failed to seed database:', e);
    }
  }

  getHello(): string {
    return 'Majestan CRM API';
  }

  private async seedLeadStatuses() {
    const statusRepo = this.dataSource.getRepository(LeadStatus);
    const statuses = [
      { name: 'INCOMING', color: '#9CA3AF' }, 
      { name: 'REJECT', color: '#F59E0B' }, 
      { name: 'OPPORTUNITY', color: '#FCD34D' }, 
      { name: 'SITE VISIT DONE', color: '#93C5FD' }, 
      { name: 'RSV DONE', color: '#818CF8' }, 
      { name: 'RSV SCHEDULE', color: '#FDE047' }, 
      { name: 'PROSPECTIVE', color: '#84CC16' }, 
      { name: 'DROPPED', color: '#EF4444' }, 
      { name: 'BOOKED', color: '#059669' }, 
      { name: 'SV SCHEDULE', color: '#7C3AED' }
    ];

    for (const status of statuses) {
      const exists = await statusRepo.findOne({ where: { name: status.name }});
      if (!exists) {
        await statusRepo.save(statusRepo.create(status));
        this.logger.log(`Seeded lead status: ${status.name}`);
      }
    }
  }

  private async seedRolesAndAdmin() {
    const roleRepo = this.dataSource.getRepository(Role);
    const userRepo = this.dataSource.getRepository(User);

    const roles = ['Admin', 'Manager', 'Team Lead', 'Staff'];
    for (const roleName of roles) {
      const exists = await roleRepo.findOne({ where: { name: roleName }});
      if (!exists) {
        await roleRepo.save(roleRepo.create({ name: roleName, description: `${roleName} Role` }));
        this.logger.log(`Seeded role: ${roleName}`);
      }
    }

    const adminEmail = 'admin@majestanrealty.com';
    const adminRole = await roleRepo.findOne({ where: { name: 'Admin' }});
    
    if (adminRole) {
      const adminExists = await userRepo.findOne({ where: { email: adminEmail }});
      if (!adminExists) {
        const password_hash = await bcrypt.hash('Prismark@2026', 10);
        await userRepo.save(userRepo.create({
          name: 'Super Admin',
          email: adminEmail,
          password_hash,
          role_id: adminRole.id,
          is_active: true
        }));
        this.logger.log(`Seeded admin user: ${adminEmail}`);
      }
    }
  }
}
