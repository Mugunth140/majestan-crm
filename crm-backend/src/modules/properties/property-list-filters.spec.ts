import { PropertiesService } from './properties.service';
import { PropertyQueryDto } from './dto/property-query.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
describe('Properties filter proxy', () => {
  it('forwards all filters before pagination to the site database API', async () => {
    const get=jest.fn(async (_path: string) => ({items:[],total:0}));
    const service=new PropertiesService({get} as any,{} as any,{} as any);
    const filters={propertyType:'commercial',listingType:'Rent',cityId:1,sublocationId:3,minSqft:0,maxSqft:2000,minBudget:1000,maxBudget:50000,floor:'Ground',specialPurpose:'Clinic',furnishingStatus:'SEMI FURNISHED',roadName:'Avinashi Road',page:2,limit:10};
    await service.findAll(filters,{role:'Admin'});
    const url=new URL(get.mock.calls[0][0] as string,'http://test');
    for(const [key,value] of Object.entries(filters))expect(url.searchParams.get(key)).toBe(String(value));
  });
  it('retains filter fields in the CRM validation whitelist', async () => {
    const dto=plainToInstance(PropertyQueryDto,{minSqft:'100',maxSqft:'2000',minBudget:'0',maxBudget:'50000',sublocationId:'3',floor:'Ground',specialPurpose:'Office',furnishingStatus:'SEMI FURNISHED',roadName:'Avinashi Road'});
    expect(await validate(dto,{whitelist:true})).toEqual([]);
    expect(dto.minSqft).toBe(100);expect(dto.sublocationId).toBe(3);expect(dto.roadName).toBe('Avinashi Road');
  });
});
