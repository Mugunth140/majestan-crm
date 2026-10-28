import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
export class CreateHrSourceDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() @MaxLength(255)
  name!: string;
}
export class UpdateHrSourceDto extends CreateHrSourceDto {
  @IsOptional() @IsBoolean()
  is_active?: boolean;
}
