import { IsDateString, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** A site visit scheduled by staff (date + local IST time, optional project and meeting point). */
export class ScheduleVisitDto {
  @IsDateString() date: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'time must be HH:mm' }) time: string;
  @IsOptional() @IsString() @MaxLength(255) project?: string;
  @IsOptional() @IsString() @MaxLength(500) location?: string;
}
