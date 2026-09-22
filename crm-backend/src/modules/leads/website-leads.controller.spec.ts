import { WebsiteLeadsController } from './website-leads.controller';

jest.mock('bun', () => ({ S3Client: class {} }), { virtual: true });

describe('WebsiteLeadsController', () => {
  it('creates an unassigned telecalling lead via LeadsService.createLead', async () => {
    const createLead = jest.fn().mockResolvedValue({ lead: { id: 7 }, isExistingCustomer: false });
    const controller = new WebsiteLeadsController({ createLead } as any);
    const result = await controller.createWebsiteLead({ name: 'Test Buyer', mobile: '9876543210', source: 'Website – WhatsApp popup' } as any);
    expect(createLead).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test Buyer', mobile: '9876543210' }));
    expect(result).toEqual(expect.objectContaining({ success: true }));
  });
});
