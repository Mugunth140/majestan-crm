import { PartialType } from '@nestjs/mapped-types';
import { CreateInboundFollowUpDto } from './create-inbound-follow-up.dto';

export class UpdateInboundFollowUpDto extends PartialType(CreateInboundFollowUpDto) {}
