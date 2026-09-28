import { IsArray, ArrayMaxSize, IsString } from 'class-validator';

export class BulkCheckMobilesDto {
  @IsArray()
  @ArrayMaxSize(5000)
  @IsString({ each: true })
  mobiles: string[];
}
