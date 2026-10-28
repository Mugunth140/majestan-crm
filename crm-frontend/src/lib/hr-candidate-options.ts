import { apiJson } from './api-fetch';
import type { HrSource } from './hr-import';
export function hrSourceOptions(sources: HrSource[], current: { hrSourceId: string; recruitmentSource: string }) {
  const eligible = sources.filter(source => Boolean(Number(source.is_active)) || String(source.id) === current.hrSourceId);
  const matched = eligible.find(source => String(source.id) === current.hrSourceId)
    || eligible.find(source => source.name === current.recruitmentSource);
  const value = matched ? String(matched.id) : current.recruitmentSource ? 'legacy-source' : '';
  const options = eligible.map(source => ({ label: source.name, value: String(source.id) }));
  if (value === 'legacy-source') options.push({ label: current.recruitmentSource, value });
  return { value, options };
}

export async function loadHrStates(): Promise<string[]> {
  const result = await apiJson<{ data: { state_name: string; is_active: number }[] }>(`${process.env.NEXT_PUBLIC_API_URL || '/api/v1'}/master/all-cities`);
  return [...new Set(result.data.filter(city => Number(city.is_active) === 1).map(city => city.state_name).filter(Boolean))].sort();
}
