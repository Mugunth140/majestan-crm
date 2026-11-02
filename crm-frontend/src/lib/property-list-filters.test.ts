import {expect,it} from 'vitest';
import {EMPTY_PROPERTY_FILTERS,propertyUploaderLabel} from './property-list-filters';
it('keeps upload filters in the filter reset defaults',()=>{
 expect(EMPTY_PROPERTY_FILTERS).toMatchObject({uploadedById:'',uploadedFrom:'',uploadedTo:''});
});
it('distinguishes staff, removed staff, owner submissions, imports and unrecorded creators',()=>{
 expect(propertyUploaderLabel({uploadedByName:'Kavya',uploadedByCrmUserId:7})).toBe('Kavya');
 expect(propertyUploaderLabel({uploadedByCrmUserId:7})).toBe('Staff #7');
 expect(propertyUploaderLabel({source:'owner-post'})).toBe('Owner submission');
 expect(propertyUploaderLabel({legacySourceId:'CS001'})).toBe('Imported');
 expect(propertyUploaderLabel({})).toBe('Not recorded');
});
