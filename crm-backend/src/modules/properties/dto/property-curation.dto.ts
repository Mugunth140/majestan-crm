import { PgAccommodationDto } from './pg-accommodation.dto';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PropertyContactDto {
  @IsOptional() @IsIn(['Care Taker', 'Security', 'Manager', '']) role?: string;
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @IsString() @MaxLength(100) phone?: string;
  @IsOptional() @IsString() @MaxLength(255) email?: string;
}

/** Private CRM contacts; never selected by public property queries. */
export class PropertyContactDetailsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => PropertyContactDto)
  ownerAlternatives?: PropertyContactDto[];
  @IsOptional() @IsString() @MaxLength(100) agentPhone?: string;
  @IsOptional() @IsString() @MaxLength(255) agentEmail?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => PropertyContactDto)
  agentAlternative?: PropertyContactDto;
}

export class PropertyPortionDto {
  @IsString() @IsNotEmpty() @MaxLength(50) bhk!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) count!: number;
}
export class PropertyParkingDto {
  @IsIn(['Car', 'Bike']) vehicle!: string;
  @IsIn(['Open', 'Covered']) type!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) count!: number;
}

/** Additive, typed specifications; legacy columns remain untouched. */
export class PropertyCurationDto {
 @IsOptional() @IsObject() @ValidateNested() @Type(() => PgAccommodationDto) pgDetails?: PgAccommodationDto;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  individualBathrooms?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  attachedBathrooms?: number;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique((p: PropertyPortionDto) => p?.bhk)
  @ValidateNested({ each: true })
  @Type(() => PropertyPortionDto)
  portions?: PropertyPortionDto[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ArrayUnique((p: PropertyParkingDto) => p?.vehicle + ':' + p?.type)
  @ValidateNested({ each: true })
  @Type(() => PropertyParkingDto)
  parkingSpaces?: PropertyParkingDto[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) passengerLifts?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) serviceLifts?: number;
  @IsOptional() @IsIn([1, 2, 3]) agricultureEb?: number;
  @IsOptional() @IsString() @MaxLength(100) roadApproach?: string;
  @IsOptional() @IsString() @MaxLength(100) storageTankCapacity?: string;
  @IsOptional() @IsString() @MaxLength(100) powerSupplyCapacity?: string;
  @IsOptional() @IsBoolean() hasCanteen?: boolean;
  @IsOptional() @IsBoolean() hasFreeRefreshment?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) restroomCount?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalRentPerMonth?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  expectedRentPerMonth?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  expectedMonthlyRentPerSqft?: number;
  @IsOptional() @IsString() @MaxLength(255) availableFloorNumbers?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  propertyUses?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  specialPurposes?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  utilities?: string[];
}
