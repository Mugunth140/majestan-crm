import { PartialType } from '@nestjs/mapped-types';
import { CreateHrFollowUpDto } from './create-hr-follow-up.dto';

export class UpdateHrFollowUpDto extends PartialType(CreateHrFollowUpDto) {}
