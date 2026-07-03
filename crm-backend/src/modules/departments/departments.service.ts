import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from '../../database/entities/department.entity';

@Injectable()
export class DepartmentsService implements OnModuleInit {
  constructor(
    @InjectRepository(Department)
    private readonly repo: Repository<Department>,
  ) {}

  async onModuleInit() {
    const defaultDepartments = [
      'Telecalling Department',
      'Sales Department',
      'Collection Department',
      'Designing Department',
      'Digital Department',
      'HR Department',
    ];

    for (const name of defaultDepartments) {
      const exists = await this.repo.findOne({ where: { name } });
      if (!exists) {
        const dept = this.repo.create({ name });
        await this.repo.save(dept);
      }
    }
  }

  async findAll() {
    return this.repo.find();
  }
}
