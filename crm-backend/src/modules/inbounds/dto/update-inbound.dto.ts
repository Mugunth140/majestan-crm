import { BadRequestException } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { CreateInboundDto } from './create-inbound.dto';

export class UpdateInboundDto extends PartialType(CreateInboundDto) {}

const REQUIRED_EDIT_FIELDS = {
  property_title: 'Property title',
  property_category: 'Category',
  property_type: 'Property type',
  purpose: 'Purpose',
  status: 'Status',
  state: 'State',
  city: 'City',
  locality: 'Locality',
  owner_name: 'Owner name',
  mobile_number: 'Mobile number',
  primary_contact: 'Contact for visits',
  key_available_with: 'Key holder',
  brokerage_accepted: 'Brokerage acceptance',
};

/** Old and quick-capture records can be incomplete. Only validate fields being changed. */
export function validateInboundRequiredEdits(patch: Partial<Record<keyof typeof REQUIRED_EDIT_FIELDS, unknown>>): void {
  for (const [key, label] of Object.entries(REQUIRED_EDIT_FIELDS)) {
    const value = patch[key as keyof typeof REQUIRED_EDIT_FIELDS];
    if (value !== undefined && (typeof value !== 'string' || !value.trim())) {
      throw new BadRequestException(`${label} is required`);
    }
  }
}
