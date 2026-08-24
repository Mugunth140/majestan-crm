import { PartialType } from '@nestjs/mapped-types';
import { CreateInboundDto } from './create-inbound.dto';

export class UpdateInboundDto extends PartialType(CreateInboundDto) {}
