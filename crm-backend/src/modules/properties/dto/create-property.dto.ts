export class CreatePropertyDto {
  title!: string;
  listingType!: 'Sell' | 'Rent';
  propertyType!: 'apartment' | 'villa' | 'plot' | 'commercial' | 'coworking' | 'farmland' | 'industrial' | 'individual_portion';
  price!: number;
  cityId!: number;
  sublocationId?: number;
  bedrooms?: number;
  bathrooms?: number;
  areaSqft?: number;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  description?: string;
  status?: 'available' | 'sold' | 'rented' | 'unavailable';
  negotiable?: boolean;
  imageUrls?: { imageUrl: string; imageKey: string; isPrimary: boolean }[];
}
