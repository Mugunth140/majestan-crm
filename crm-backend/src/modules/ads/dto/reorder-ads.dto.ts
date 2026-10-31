import { ArrayMinSize, ArrayUnique, IsArray, IsInt, Min } from 'class-validator';
export class ReorderAdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];
}
