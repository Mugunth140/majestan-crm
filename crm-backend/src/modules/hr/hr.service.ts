import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HrCandidate } from './entities/hr-candidate.entity';

@Injectable()
export class HrService {
  constructor(
    @InjectRepository(HrCandidate)
    private repo: Repository<HrCandidate>,
  ) {}

  findAll() { return this.repo.find({ order: { createdAt: 'DESC' } }); }
  async findOne(id: number) {
    const candidate = await this.repo.findOne({ where: { id } });
    if (!candidate) {
      throw new NotFoundException(`Candidate with ID ${id} not found`);
    }
    return candidate;
  }
  create(data: Partial<HrCandidate>) { return this.repo.save(this.repo.create(data)); }
  async update(id: number, data: Partial<HrCandidate>) {
    await this.findOne(id);
    await this.repo.update(id, data);
    return this.repo.findOne({ where: { id } });
  }
  async remove(id: number) {
    await this.findOne(id);
    await this.repo.delete(id);
  }
}
