import { PartialType } from '@nestjs/mapped-types';
import { CreateHrCandidateDto } from './create-hr-candidate.dto';

export class UpdateHrCandidateDto extends PartialType(CreateHrCandidateDto) {}
