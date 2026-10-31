import { PropertyTypeRegistryService } from './property-type-registry.service';
it('seeds only missing curated types and preserves existing inactive/custom labels', async () => {
  const query = jest.fn().mockResolvedValue([]);
  await new PropertyTypeRegistryService({ query } as any).onApplicationBootstrap();
  expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT IGNORE'), [
    'Investment Property', 'investment_property', 'PG / Service Apartment', 'pg_service_apartment', 'Farm House', 'farm_house',
  ]);
  expect(query.mock.calls[0][0]).not.toContain('UPDATE');
});
