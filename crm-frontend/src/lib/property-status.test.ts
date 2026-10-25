import {describe,expect,it} from 'vitest';
import {propertyStatusLabel,propertyStatusValue} from './property-status';
describe('property archive terminology',()=>{
 it('renames approved legacy unavailable rows to Archived',()=>{
  expect(propertyStatusValue('unavailable','Approved')).toBe('archived');
  expect(propertyStatusLabel('unavailable','Approved')).toBe('Archived');
 });
 it('does not archive a pending submission when editing other fields',()=>{
  expect(propertyStatusValue('unavailable','Pending')).toBe('unavailable');
  expect(propertyStatusLabel('unavailable','Pending')).toBe('Pending review');
 });
 it.each(['available','sold','rented','archived'])('retains the explicit %s status',status=>{
  expect(propertyStatusValue(status,'Approved')).toBe(status);
 });
});
