import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role } from './database/entities/role.entity';
import { User } from './database/entities/user.entity';
import { LeadSource } from './database/entities/lead-source.entity';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);

  constructor(@InjectDataSource() private dataSource: DataSource) {}

  async onModuleInit() {
    try {
      await this.seedRolesAndAdmin();
      await this.seedLeadSources();
    } catch (e) {
      this.logger.error('Failed to seed database:', e);
    }
  }

  getHello(): string {
    return 'Majestan CRM API';
  }

  private async seedLeadSources() {
    const sourceRepo = this.dataSource.getRepository(LeadSource);
    const defaults = [
      'Direct Walk-in',
      'Website',
      'Referral',
      'Social Media',
      'Phone Inquiry',
      'Email',
      'Property Portal',
      'Advertisement',
      'Cold Call',
    ];

    for (const name of defaults) {
      const exists = await sourceRepo.findOne({ where: { name } });
      if (!exists) {
        await sourceRepo.save(sourceRepo.create({ name }));
        this.logger.log(`Seeded lead source: ${name}`);
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
