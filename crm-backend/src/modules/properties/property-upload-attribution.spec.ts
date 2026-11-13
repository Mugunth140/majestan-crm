import {PropertiesService} from './properties.service';
import {User} from '../../database/entities/user.entity';
import {PropertyQueryDto} from './dto/property-query.dto';
import {plainToInstance} from 'class-transformer';
import {validate} from 'class-validator';

function setup(items:any[]=[]) {
 const post=jest.fn(async()=>({id:9})),patch=jest.fn(async()=>({}));
 const get=jest.fn(async(path:string)=>path==='/properties/form-data'?{cities:[{id:1,cityName:'Coimbatore'}],sublocations:[]}:path.startsWith('/admin/properties/all?')?{items,total:45}:{id:9,propertyType:'apartment',listingType:'Sell',propertyDetails:{}});
 const find=jest.fn(async()=>[{id:7,name:'Kavya'}]);
 const getRepository=jest.fn(()=>({find}));
 const service=new PropertiesService({get,post,patch} as any,{hasPermission:jest.fn(async()=>false)} as any,{getRepository} as any);
 return{service,get,post,patch,find,getRepository};
}
it('captures the signed-in creator and ignores forged input identity',async()=>{
 const {service,post}=setup();
 await service.create({title:'Apartment',propertyType:'apartment',cityId:1,price:5000000,uploadedByCrmUserId:999} as any,{sub:7});
 expect(post).toHaveBeenCalledWith('/admin/properties/apartment',expect.objectContaining({uploadedByCrmUserId:7}));
});
it('attributes bulk uploads to the signed-in creator',async()=>{
 const {service,post}=setup();
 await service.bulkImport({properties:[{title:'Apartment',propertyType:'apartment',city:'Coimbatore',price:5000000,uploadedByCrmUserId:999}]} as any,{sub:7});
 expect(post).toHaveBeenCalledWith('/admin/properties/apartment',expect.objectContaining({uploadedByCrmUserId:7}));
});
it('never reassigns a creator on edits',async()=>{
 const {service,patch}=setup();
 await service.update(9,{title:'Updated title',uploadedByCrmUserId:999} as any,{sub:8});
 expect((patch.mock.calls[0] as unknown[])[1]).not.toHaveProperty('uploadedByCrmUserId');
});
it('joins staff names in one CRM query while preserving server pagination and forwarding filters',async()=>{
 const {service,get,find,getRepository}=setup([{id:9,uploadedByCrmUserId:7,ownerPhone:'private'},{id:10,uploadedByCrmUserId:8}]);
 const result=await service.findAll({page:2,limit:10,uploadedById:7,uploadedFrom:'2026-11-01',uploadedTo:'2026-11-02'});
 const url=new URL(get.mock.calls[0][0],'http://test');
 expect(url.searchParams.get('uploadedById')).toBe('7');expect(url.searchParams.get('uploadedFrom')).toBe('2026-11-01');expect(url.searchParams.get('uploadedTo')).toBe('2026-11-02');
 expect(getRepository).toHaveBeenCalledWith(User);expect(find).toHaveBeenCalledTimes(1);
 expect(find).toHaveBeenCalledWith(expect.objectContaining({select:{id:true,name:true}}));
 expect(result.data[0]).toMatchObject({uploadedByName:'Kavya'});expect(result.data[0]).not.toHaveProperty('ownerPhone');expect(result.data[1]).toMatchObject({uploadedByName:null});expect(result.meta.total).toBe(45);
});
it('does not guess an uploader for historical listings',async()=>{
 const {service,find}=setup([{id:9,ownerId:7}]);
 expect((await service.findAll({})).data[0]).not.toHaveProperty('uploadedByName');expect(find).not.toHaveBeenCalled();
});
it.each([{uploadedById:0},{uploadedById:1.5},{uploadedFrom:'2026-02-30'},{uploadedTo:'2026-11-01T12:00:00Z'}])('rejects malformed upload filters %j',async value=>{
 expect((await validate(plainToInstance(PropertyQueryDto,value),{whitelist:true})).length).toBeGreaterThan(0);
});
it('returns only staff directory display fields, including inactive staff',async()=>{
 const {service,getRepository}=setup();
 getRepository.mockImplementation((entity?:any)=>({find:jest.fn(async()=>entity===User?[{id:7,name:'Kavya',is_active:false,password_hash:'private',email:'private@example.com'}]:[])}));
 const data=await service.findFormData();
 expect(data.staff).toEqual([{id:7,name:'Kavya',isActive:false}]);
});
it('keeps the inventory usable if staff name resolution is temporarily unavailable',async()=>{
 const {service,find}=setup([{id:9,uploadedByCrmUserId:7}]);
 find.mockRejectedValueOnce(new Error('directory unavailable'));
 const spy=jest.spyOn(console,'error').mockImplementation(()=>{});
 try {expect((await service.findAll({})).data[0]).toMatchObject({uploadedByCrmUserId:7,uploadedByName:null});}finally{spy.mockRestore();}
});
