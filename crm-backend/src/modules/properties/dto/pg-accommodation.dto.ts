import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsIn,
  IsInt,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  ArrayMaxSize,
  ArrayUnique,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
export class PgFurnishingDto {
  @IsString() @MaxLength(100) item!: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(100000) count!: number;
}
export class PgServiceDto {
  @IsIn(['Laundry', 'Electricity', 'Water', 'Wifi', 'Housekeeping', 'DTH'])
  name!: string;
  @IsIn(['Included in rent', 'Not available', 'Available for extra charge', ''])
  status!: string;
  @IsOptional()
  @IsIn(['Fixed amount', 'On consumption basis', ''])
  chargeType?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) amount?: number;
}
export class PgAccommodationDto {
  @IsOptional()
  @IsIn([
    'Flat/Apartment',
    'Independent House / Villa',
    'Builder Floor',
    '1 RK / Studio Apartment',
    'Serviced Apartment',
    '',
  ])
  category?: string;
  @IsOptional() @IsIn(['Sharing', 'Private', '']) roomType?: string;
  @IsOptional() @IsIn(['Girls', 'Boys', 'Any', '']) availableFor?: string;
  @IsOptional()
  @IsIn(['Fixed', 'Multiple of Rent', 'None', ''])
  depositType?: string;
  @IsOptional()
  @IsIn(['Monthly', 'Annually', 'One Time', 'Per Unit/Monthly', ''])
  maintenancePeriod?: string;
  @IsOptional()
  @IsIn(['Available', 'Not Available', ''])
  foodAvailable?: string;
  @IsOptional() @IsIn(['Only Veg', 'Veg & Non Veg', '']) mealType?: string;
  @IsOptional()
  @IsIn(['Included in rent', 'Per meal basis', 'Fixed monthly amount', ''])
  foodChargeType?: string;
  @IsOptional()
  @IsIn(['None', 'Fixed', 'Multiple of Rent', ''])
  earlyLeavingType?: string;
  @IsOptional() @IsIn(['Yes', 'No', '']) petsAllowed?: string;
  @IsOptional() @IsIn(['Yes', 'No', '']) visitorsAllowed?: string;
  @IsOptional() @IsIn(['Yes', 'No', '']) smokingAllowed?: string;
  @IsOptional() @IsIn(['Yes', 'No', '']) alcoholAllowed?: string;
  @IsOptional() @IsIn(['Yes', 'No', '']) partyeventAllowed?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  sharingCount?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  totalCapacity?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  availableCapacity?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  coveredParking?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  openParking?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  depositMonths?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  earlyLeavingMonths?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(36)
  minimumContractMonths?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  noticeMonths?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) depositAmount?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maintenanceAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) bookingAmount?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  membershipCharge?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  foodMonthlyCharge?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  breakfastCharge?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) lunchCharge?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) dinnerCharge?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  earlyLeavingAmount?: number;
  @IsOptional() @IsBoolean() attachedBathroom?: boolean;
  @IsOptional() @IsBoolean() attachedBalcony?: boolean;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsIn(['Students', 'Working Professionals'], { each: true })
  suitableFor?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsIn(['Pooja Room', 'Study Room', 'Servant Room', 'Store Room'], {
    each: true,
  })
  otherRooms?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsIn(['Breakfast', 'Lunch', 'Dinner'], { each: true })
  weekdayMeals?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsIn(['Breakfast', 'Lunch', 'Dinner'], { each: true })
  weekendMeals?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique((row: PgFurnishingDto) => row?.item)
  @ValidateNested({ each: true })
  @Type(() => PgFurnishingDto)
  roomFurnishings?: PgFurnishingDto[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique((row: PgFurnishingDto) => row?.item)
  @ValidateNested({ each: true })
  @Type(() => PgFurnishingDto)
  commonFurnishings?: PgFurnishingDto[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ArrayUnique((row: PgServiceDto) => row?.name)
  @ValidateNested({ each: true })
  @Type(() => PgServiceDto)
  services?: PgServiceDto[];
  @IsOptional()
  @IsIn([
    '19:00',
    '19:30',
    '20:00',
    '20:30',
    '21:00',
    '21:30',
    '22:00',
    '22:30',
    '23:00',
    '23:30',
    '00:00',
    '',
  ])
  lastEntryTime?: string;
  @IsOptional() @IsString() @MaxLength(2000) otherRules?: string;
}
