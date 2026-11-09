import type { Asset } from '../../database/entities/asset.entity';
import type { CreateAssetDto } from './dto/create-asset.dto';

/** The site-visit columns present in a request; empty strings clear them. */
export function visitFields(dto: CreateAssetDto): Partial<Asset> {
  const fields: Partial<Asset> = {};
  if (dto.visited_date !== undefined) fields.visited_date = (dto.visited_date || null) as unknown as Date;
  for (const key of ['site_visited_done', 'checked_by', 'approved_by'] as const) {
    if (dto[key] !== undefined) fields[key] = (dto[key] || null) as string;
  }
  return fields;
}
