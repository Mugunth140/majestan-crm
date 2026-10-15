import { ArrayMaxSize, IsArray, IsInt, Min } from 'class-validator';

export class ReplaceShowcaseDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];
}
