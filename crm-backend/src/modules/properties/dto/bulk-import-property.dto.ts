export class BulkPropertyRowDto {
  title!: string;
  listingType!: string;
  propertyType!: string;
  price!: number;
  city!: string;
  locality?: string;
  bedrooms?: number;
  bathrooms?: number;
  areaSqft?: number;
  ownerName?: string;
  ownerPhone?: string;
  description?: string;
}

export class BulkImportPropertyDto {
  properties!: BulkPropertyRowDto[];
}
