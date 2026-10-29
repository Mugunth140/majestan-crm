import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsInt, Min, ValidateIf } from 'class-validator';
export class AssignInboundsDto {
  @IsArray() @ArrayNotEmpty() @ArrayUnique() @ArrayMaxSize(500)
  @IsInt({ each: true }) @Min(1, { each: true })
  inboundIds: number[];

  @ValidateIf((_object, value) => value !== null)
  @IsInt() @Min(1)
  staffId: number | null;
}
