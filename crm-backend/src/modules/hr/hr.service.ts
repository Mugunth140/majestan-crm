import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HrCandidate } from '../../database/entities/hr-candidate.entity';
import { HrFollowUp } from '../../database/entities/hr-follow-up.entity';

@Injectable()
export class HrService {
  constructor(
    @InjectRepository(HrCandidate)
    private repo: Repository<HrCandidate>,
    @InjectRepository(HrFollowUp)
    private fuRepo: Repository<HrFollowUp>,
  ) {}

  findAll() { return this.repo.find({ order: { createdAt: 'DESC' } }); }
  async findOne(id: number) {
    const candidate = await this.repo.findOne({ where: { id } });
    if (candidate) {
      const followUps = await this.fuRepo.find({ where: { hr_candidate_id: id }, order: { created_at: 'DESC' } });
      (candidate as any).follow_ups = followUps;
    }
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

  async addFollowUp(id: number, data: Partial<HrFollowUp>) {
    const fu = this.fuRepo.create({ ...data, hr_candidate_id: id });
    return this.fuRepo.save(fu);
  }
  async updateFollowUp(id: number, fuId: number, data: Partial<HrFollowUp>) {
    await this.fuRepo.update(fuId, data);
    return { success: true };
  }
  async deleteFollowUp(id: number, fuId: number) {
    await this.fuRepo.delete(fuId);
    return { success: true };
  }
}