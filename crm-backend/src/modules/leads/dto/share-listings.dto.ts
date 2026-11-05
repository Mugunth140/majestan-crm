import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_SHARE_ITEMS } from '../share/lead-share.service';

export class ShareItemDto {
  @IsIn(['property', 'project']) kind: 'property' | 'project';
  @Type(() => Number) @IsInt() @Min(1) id: number;
}

export class ShareListingsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SHARE_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => ShareItemDto)
  items: ShareItemDto[];
}

export class LogShareDto extends ShareListingsDto {
  @IsIn(['email', 'whatsapp']) channel: 'email' | 'whatsapp';
}
