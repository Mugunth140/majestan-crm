import { IsDateString, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';

/** What people may change on their own record. Role, team, email, Aadhaar and bank stay with admins. */
export class SelfUpdateDto {
  @IsOptional() @IsString() @Length(2, 80)
  name?: string;

  @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(20)
  whatsapp_no?: string;

  @IsOptional() @IsString() @MaxLength(500)
  address?: string;

  @IsOptional() @IsDateString()
  dob?: string;

  @IsOptional() @IsString() @MaxLength(120)
  qualification?: string;
}

export class ChangePasswordDto {
  @IsString() @MinLength(1)
  current: string;

  @IsString() @MinLength(8) @MaxLength(128)
  next: string;
}
