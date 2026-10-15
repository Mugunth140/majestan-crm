import { PartialType } from '@nestjs/mapped-types';
import { IsISO8601, IsOptional } from 'class-validator';
import { CreatePropertyDto } from './create-property.dto';

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {
  /**
   * The record version (updatedAt) the editor loaded. The site API refuses
   * the save with 409 if someone else saved since, instead of overwriting.
   */
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;
}
