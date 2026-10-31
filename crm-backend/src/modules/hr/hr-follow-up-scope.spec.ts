import { HrService } from './hr.service';
function setup(affected: number) {
 const fu = { update: jest.fn(async () => ({ affected })), delete: jest.fn(async () => ({ affected })) };
 return { fu, service: new HrService({} as any, fu as any, {} as any, {} as any, {} as any) };
}
it('scopes follow-up edits and deletion to their candidate', async () => {
 const { service, fu } = setup(1);
 await service.updateFollowUp(7, 42, { notes: 'Confirmed interview' }); await service.deleteFollowUp(7, 42);
 expect(fu.update).toHaveBeenCalledWith({ id: 42, hr_candidate_id: 7 }, { notes: 'Confirmed interview' });
 expect(fu.delete).toHaveBeenCalledWith({ id: 42, hr_candidate_id: 7 });
});
it('returns not-found for a missing or mismatched follow-up instead of reporting success', async () => {
 const { service } = setup(0);
 await expect(service.updateFollowUp(7, 42, {})).rejects.toThrow('Follow-up not found'); await expect(service.deleteFollowUp(7, 42)).rejects.toThrow('Follow-up not found');
});
