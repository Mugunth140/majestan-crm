// @vitest-environment jsdom
import React from "react";
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({fetch:vi.fn(),list:[{id:9,title:'Apartment',uploadedByName:'Kavya'}]}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()})}));
vi.mock('@/hooks/use-debounce',()=>({useDebounce:(value:unknown)=>value}));
vi.mock('@/hooks/use-properties-list',()=>({usePropertiesList:()=>({properties:mock.list,totalCount:1,isLoading:false,staff:[{id:7,name:'Kavya',isActive:true},{id:8,name:'Arun',isActive:false}],cities:[],sublocations:[],roadNames:[],propertyTypes:[],fetchProperties:mock.fetch,toggleVisibility:vi.fn(),deleteBulk:vi.fn()})}));
vi.mock('@/components/layout/mobile-header',()=>({MobileHeader:()=>null}));
vi.mock('@/components/shared/device',()=>({Device:({desktop}:any)=>desktop}));
vi.mock('@/components/tables/data-table',()=>({DataTable:({columns,data}:any)=>{
 const uploader=columns.find((c:any)=>c.id==='uploadedBy');
 return <div>{columns.filter((c:any)=>typeof c.header==='string').map((c:any)=><span key={c.id||c.accessorKey}>{c.header}</span>)}{uploader?.cell({row:{original:data[0]}})}</div>;
}}));
import PropertiesPage from './page';
beforeEach(()=>{sessionStorage.clear();localStorage.clear();mock.fetch.mockClear(); window.scrollTo=vi.fn(); vi.stubGlobal("ResizeObserver",class {observe(){} unobserve(){} disconnect(){}});});
it('shows the uploader column and combines staff/date filters before fetching the list',async()=>{
 render(<PropertiesPage/>);
 expect(screen.getByText('Kavya')).toBeTruthy();expect(screen.getByText('Uploaded on')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Filters',exact:true}));
 const staff=await screen.findByRole('combobox',{name:'Uploaded by'});
 fireEvent.click(staff);
 fireEvent.click(await screen.findByRole('option',{name:'Kavya',exact:true}));
 fireEvent.change(screen.getByLabelText('Uploaded from'),{target:{value:'2026-11-01'}});
 fireEvent.change(screen.getByLabelText('Uploaded to'),{target:{value:'2026-11-02'}});
 await waitFor(()=>expect(mock.fetch).toHaveBeenLastCalledWith(expect.objectContaining({pagination:{pageIndex:0,pageSize:10},filters:expect.objectContaining({uploadedById:'7',uploadedFrom:'2026-11-01',uploadedTo:'2026-11-02'})})));
 fireEvent.click(screen.getByRole('button',{name:'Clear All'}));
 await waitFor(()=>expect(mock.fetch).toHaveBeenLastCalledWith(expect.objectContaining({filters:expect.objectContaining({uploadedById:'',uploadedFrom:'',uploadedTo:''})})));
});
