import { PartialType } from '@nestjs/mapped-types';
import { CreateLeadFollowUpDto } from './create-lead-follow-up.dto';

export class UpdateLeadFollowUpDto extends PartialType(CreateLeadFollowUpDto) {}
