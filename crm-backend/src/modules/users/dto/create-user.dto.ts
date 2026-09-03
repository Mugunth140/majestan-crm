import { IsString, IsEmail, IsOptional, IsBoolean, IsInt, IsDateString, IsArray } from 'class-validator';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  whatsapp_no?: string;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsString()
  aadhaar_no?: string;

  @IsOptional()
  @IsString()
  bank_account_no?: string;

  @IsOptional()
  @IsDateString()
  join_date?: string;

  @IsOptional()
  @IsString()
  qualification?: string;

  @IsInt()
  role_id: number;

  @IsOptional()
  @IsInt()
  department_id?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionKeys?: string[];
}
