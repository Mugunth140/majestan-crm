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
      'Sourcing Department',
    ];

    // "Sales" and "Sales Department" are the same team: only add a default
    // when no department of that name, with or without the suffix, exists.
    const existing = new Set((await this.repo.find()).map(d => departmentBase(d.name)));
    for (const name of defaultDepartments) {
      if (existing.has(departmentBase(name))) continue;
      await this.repo.save(this.repo.create({ name }));
      existing.add(departmentBase(name));
    }
  }

  async findAll() {
    return this.repo.find();
  }
}

/** "Sales Department" and " sales " both become "sales". */
export function departmentBase(name: string): string {
  return name.toLowerCase().trim().replace(/\s+(department|dept)$/, '').trim();
}
