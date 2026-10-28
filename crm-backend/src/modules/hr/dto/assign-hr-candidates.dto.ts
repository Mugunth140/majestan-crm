import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsInt, Min, ValidateIf } from 'class-validator';
export class AssignHrCandidatesDto {
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(500) @ArrayUnique() @IsInt({ each: true }) @Min(1, { each: true })
  candidateIds!: number[];
  @ValidateIf((_object, value) => value !== null) @Type(() => Number) @IsInt() @Min(1)
  assignedStaffId!: number | null;
}
