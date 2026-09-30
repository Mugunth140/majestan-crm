import { Test, TestingModule } from '@nestjs/testing';
import { LeadsService } from './leads.service';
import { Lead } from '../../database/entities/lead.entity';
import { LeadFollowUp } from '../../database/entities/lead-follow-up.entity';
import { LeadInquiry } from '../../database/entities/lead-inquiry.entity';
import { User } from '../../database/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { TasksService } from '../tasks/tasks.service';
import { getDataSourceToken } from '@nestjs/typeorm';

jest.mock('bun', () => ({
  S3Client: class {}
}), { virtual: true });

// Regression coverage for the optional "Staff ID" column of the bulk import
// template. The frontend sends the reviewed staff user id as `assignedStaffId`
// on each lead row; this file locks the four backend guarantees that decide what
// the created Lead actually gets persisted, so a future refactor of
// bulkCreateLeads cannot silently change where an imported lead lands.
//
// Harness: mirrors leads-bulk-assign-insert.spec.ts (same DataSource/manager
// mocks, same `actionedBy` shape the JwtAuthGuard puts on req.user).
describe('LeadsService.bulkCreateLeads bulk-import Staff ID column', () => {
  let service: LeadsService;
  let savedLeads: any[];
  let leadSeq: number;
  let findUsersImpl: jest.Mock;
  let existingLeadsImpl: jest.Mock;

  // Look saved rows up by mobile so assertions do not depend on the order in
  // which the service happened to group the rows.
  const savedByMobile = (mobile: string) =>
    savedLeads.find((l) => l.mobile_number === mobile);

  beforeEach(async () => {
    savedLeads = [];
    leadSeq = 0;
    findUsersImpl = jest.fn(async () => []);
    existingLeadsImpl = jest.fn(async () => []);

    const leadRepo = {
      createQueryBuilder: () => ({
        where: () => ({ getMany: existingLeadsImpl }),
      }),
      create: (obj: any) => ({ ...obj }),
    };
    const userRepo = { find: findUsersImpl };
    const inquiryRepo = { create: (obj: any) => ({ ...obj }) };
    const followUpRepo = { create: (obj: any) => ({ ...obj }) };
    const manager = {
      getRepository: (entity: any) => {
        if (entity === Lead) return leadRepo;
        if (entity === User) return userRepo;
        if (entity === LeadInquiry) return inquiryRepo;
        if (entity === LeadFollowUp) return followUpRepo;
        throw new Error('unexpected repository');
      },
      save: jest.fn(async (entity: any, entities?: any) => {
        const list = Array.isArray(entities) ? entities : [entities];
        if (entity === Lead) {
          const saved = list.map((e) => ({ ...e, id: ++leadSeq }));
          savedLeads.push(...saved);
          return saved;
        }
        return list;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        {
          provide: getDataSourceToken(),
          useValue: { transaction: jest.fn(async (cb: any) => cb(manager)) },
        },
        {
          provide: getDataSourceToken('site'),
          useValue: {},
        },
        {
          provide: NotificationsService,
          useValue: {},
        },
        {
          provide: TasksService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
  });

  // ── Rule 1: a known Staff ID assigns the lead to that user and to the
  // pipeline derived from the user's department ─────────────────────────────
  describe('known Staff ID', () => {
    it('sets assigned_staff_id and routes the lead to the sales pipeline', async () => {
      findUsersImpl.mockResolvedValueOnce([{ id: 12, department: { name: 'Sales' } }]);

      const result = await service.bulkCreateLeads(
        [{ name: 'Sales Buyer', mobile: '9810000001', source: 'Website', assignedStaffId: 12 }],
        { id: 1, role: 'Admin' },
      );

      expect(findUsersImpl).toHaveBeenCalledTimes(1);
      expect(savedLeads).toHaveLength(1);
      expect(savedLeads[0].assigned_staff_id).toBe(12);
      expect(savedLeads[0].department).toBe('sales');
      expect(result).toMatchObject({ created: 1, assigned: 1 });
    });

    it('takes the pipeline from the user department, not from a hardcoded value', async () => {
      findUsersImpl.mockResolvedValueOnce([{ id: 13, department: { name: 'Telecalling' } }]);

      await service.bulkCreateLeads(
        [{ name: 'Tele Buyer', mobile: '9810000002', source: 'Website', assignedStaffId: 13 }],
        { id: 1, role: 'Admin' },
      );

      expect(savedLeads[0].assigned_staff_id).toBe(13);
      expect(savedLeads[0].department).toBe('telecalling');
    });

    it('ignores the " department" suffix on the department name', async () => {
      findUsersImpl.mockResolvedValueOnce([{ id: 14, department: { name: 'Sales Department' } }]);

      await service.bulkCreateLeads(
        [{ name: 'Suffixed Buyer', mobile: '9810000003', source: 'Website', assignedStaffId: 14 }],
        { id: 1, role: 'Admin' },
      );

      expect(savedLeads[0].assigned_staff_id).toBe(14);
      expect(savedLeads[0].department).toBe('sales');
    });
  });

  // ── Rule 2: an unknown Staff ID must not fail the import ─────────────────
  describe('unknown Staff ID', () => {
    it('leaves assigned_staff_id null and drops the lead in the routing queue', async () => {
      findUsersImpl.mockResolvedValueOnce([]);

      const result = await service.bulkCreateLeads(
        [{ name: 'Unknown Buyer', mobile: '9810000004', source: 'Website', assignedStaffId: 999 }],
        { id: 1, role: 'Admin' },
      );

      expect(savedLeads).toHaveLength(1);
      expect(savedLeads[0].assigned_staff_id).toBeNull();
      expect(savedLeads[0].department).toBe('telecalling');
      expect(result).toMatchObject({ created: 1, assigned: 0 });
    });

    it('resolves the rest of the batch when only some IDs are unknown', async () => {
      findUsersImpl.mockResolvedValueOnce([{ id: 12, department: { name: 'Sales' } }]);

      const result = await service.bulkCreateLeads([
        { name: 'Known Buyer', mobile: '9810000005', source: 'Website', assignedStaffId: 12 },
        { name: 'Ghost Buyer', mobile: '9810000006', source: 'Website', assignedStaffId: 999 },
      ], { id: 1, role: 'Admin' });

      expect(savedLeads).toHaveLength(2);
      expect(savedByMobile('9810000005')).toMatchObject({
        assigned_staff_id: 12,
        department: 'sales',
      });
      expect(savedByMobile('9810000006')).toMatchObject({
        assigned_staff_id: null,
        department: 'telecalling',
      });
      expect(result).toMatchObject({ created: 2, assigned: 1 });
    });
  });

  // ── Rule 3: a Staff caller cannot skip the routing queue ─────────────────
  describe('Staff-role importer', () => {
    it('strips the Staff ID when actionedBy.role is the role name', async () => {
      const result = await service.bulkCreateLeads(
        [{ name: 'Staff Buyer', mobile: '9810000007', source: 'Website', assignedStaffId: 12 }],
        { id: 2, role: 'Staff' },
      );

      // Stripped before the lookup, so the users table is never even queried.
      expect(findUsersImpl).not.toHaveBeenCalled();
      expect(savedLeads[0].assigned_staff_id).toBeNull();
      expect(savedLeads[0].department).toBe('telecalling');
      expect(result).toMatchObject({ created: 1, assigned: 0 });
    });

    it('strips the Staff ID when actionedBy.role is the loaded role relation', async () => {
      const result = await service.bulkCreateLeads(
        [{ name: 'Staff Buyer 2', mobile: '9810000008', source: 'Website', assignedStaffId: 12 }],
        { id: 2, role: { name: 'Staff' } },
      );

      expect(findUsersImpl).not.toHaveBeenCalled();
      expect(savedLeads[0].assigned_staff_id).toBeNull();
      expect(savedLeads[0].department).toBe('telecalling');
      expect(result).toMatchObject({ created: 1, assigned: 0 });
    });

    it('still assigns for a Super Admin importer', async () => {
      findUsersImpl.mockResolvedValueOnce([{ id: 12, department: { name: 'Sales' } }]);

      const result = await service.bulkCreateLeads(
        [{ name: 'Boss Buyer', mobile: '9810000009', source: 'Website', assignedStaffId: 12 }],
        { id: 3, role: 'Super Admin' },
      );

      expect(savedLeads[0].assigned_staff_id).toBe(12);
      expect(result).toMatchObject({ created: 1, assigned: 1 });
    });
  });

  // ── Rule 4: a user with no department link cannot be a valid assignee ─────
  describe('Staff member without a department', () => {
    it('leaves the lead unassigned when department is null', async () => {
      findUsersImpl.mockResolvedValueOnce([{ id: 15, department: null }]);

      const result = await service.bulkCreateLeads(
        [{ name: 'No Dept Buyer', mobile: '9810000010', source: 'Website', assignedStaffId: 15 }],
        { id: 1, role: 'Admin' },
      );

      expect(savedLeads[0].assigned_staff_id).toBeNull();
      expect(savedLeads[0].department).toBe('telecalling');
      expect(result).toMatchObject({ created: 1, assigned: 0 });
    });

    it('leaves the lead unassigned when the department relation is missing entirely', async () => {
      findUsersImpl.mockResolvedValueOnce([{ id: 16 }]);

      const result = await service.bulkCreateLeads(
        [{ name: 'No Relation Buyer', mobile: '9810000011', source: 'Website', assignedStaffId: 16 }],
        { id: 1, role: 'Admin' },
      );

      expect(savedLeads[0].assigned_staff_id).toBeNull();
      expect(savedLeads[0].department).toBe('telecalling');
      expect(result).toMatchObject({ created: 1, assigned: 0 });
    });

    it('leaves the lead unassigned when the department name is blank', async () => {
      findUsersImpl.mockResolvedValueOnce([{ id: 17, department: { name: '   ' } }]);

      const result = await service.bulkCreateLeads(
        [{ name: 'Blank Dept Buyer', mobile: '9810000012', source: 'Website', assignedStaffId: 17 }],
        { id: 1, role: 'Admin' },
      );

      expect(savedLeads[0].assigned_staff_id).toBeNull();
      expect(savedLeads[0].department).toBe('telecalling');
      expect(result).toMatchObject({ created: 1, assigned: 0 });
    });
  });

  // ── The full mixed file: one import carrying every Staff ID outcome at once ─
  it('applies each rule independently across a single mixed import file', async () => {
    findUsersImpl.mockResolvedValueOnce([
      { id: 12, department: { name: 'Sales' } },
      { id: 13, department: { name: 'Telecalling' } },
      { id: 16, department: null },
    ]);

    const result = await service.bulkCreateLeads([
      { name: 'A', mobile: '9810000101', source: 'Website', assignedStaffId: 12 },
      { name: 'B', mobile: '9810000102', source: 'Website', assignedStaffId: 13 },
      { name: 'C', mobile: '9810000103', source: 'Website', assignedStaffId: 999 },
      { name: 'D', mobile: '9810000104', source: 'Website', assignedStaffId: 16 },
      { name: 'E', mobile: '9810000105', source: 'Website' },
    ], { id: 1, role: 'Admin' });

    // Every Staff ID in the file is resolved in one users lookup.
    expect(findUsersImpl).toHaveBeenCalledTimes(1);
    expect(findUsersImpl.mock.calls[0][0]).toMatchObject({
      where: { id: expect.anything() },
      relations: { department: true },
    });

    expect(savedByMobile('9810000101')).toMatchObject({ assigned_staff_id: 12, department: 'sales' });
    expect(savedByMobile('9810000102')).toMatchObject({ assigned_staff_id: 13, department: 'telecalling' });
    expect(savedByMobile('9810000103')).toMatchObject({ assigned_staff_id: null, department: 'telecalling' });
    expect(savedByMobile('9810000104')).toMatchObject({ assigned_staff_id: null, department: 'telecalling' });
    expect(savedByMobile('9810000105')).toMatchObject({ assigned_staff_id: null, department: 'telecalling' });
    expect(result).toMatchObject({ created: 5, assigned: 2 });
  });
});
