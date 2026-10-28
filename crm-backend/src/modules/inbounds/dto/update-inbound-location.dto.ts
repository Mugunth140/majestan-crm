import { IsLatitude, IsLongitude, IsNumber } from 'class-validator';

export class UpdateInboundLocationDto {
  @IsNumber()
  @IsLatitude()
  latitude!: number;

  @IsNumber()
  @IsLongitude()
  longitude!: number;
}
