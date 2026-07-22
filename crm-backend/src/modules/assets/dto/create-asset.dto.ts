export class CreateAssetDto {
  owner_name: string;
  mobile_number: string;
  location?: { district?: string; site_location?: string; google_pin?: string; };
  financials?: { land_price?: number; dtcp_price?: number; expectation?: number; payment_options?: string; };
  features?: { extent?: string; soil_type?: string; water_source?: string; near_railway?: boolean; near_water_body?: boolean; };
}
