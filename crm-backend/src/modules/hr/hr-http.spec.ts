import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { HrDocumentsService } from './hr-documents.service';
import { HrController } from './hr.controller';
import { RolesGuard } from '../auth/roles.guard';
import { HrService } from './hr.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { hrImportJsonParser } from '../../common/middleware/hr-import-json';

describe('HR HTTP body parsing', () => {
  let app: INestApplication;
  let base: string;
  const service = {
    bulkImport: jest.fn(async candidates => ({ success: true, created: candidates.length })),
    update: jest.fn(async (_id, data) => data),
    create: jest.fn(async data => data),
    findOne: jest.fn(async () => ({ id: 7, resumeUrl: 'hr-private://document-reference' })),
    saveDocument: jest.fn(async () => ({ success: true })),
  };
  const documents = {
    upload: jest.fn(async () => 'hr-private://document-reference'),
    read: jest.fn(async () => ({ buffer: Buffer.from('%PDF-1.7 synthetic'), contentType: 'application/pdf', filename: 'candidate.pdf' })),
    discard: jest.fn(async () => {}),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [HrController], providers: [{ provide: HrService, useValue: service }, { provide: HrDocumentsService, useValue: documents }] })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true }).overrideGuard(RolesGuard).useValue({ canActivate: () => true }).compile();
    app = module.createNestApplication();
    app.use('/api/v1/hr/bulk', hrImportJsonParser);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });
  afterAll(async () => { await app.close(); });
  it('accepts a 500-row import larger than the default JSON body limit', async () => {
    const row = { name: 'A'.repeat(255), mobile: '9876543210', role: 'B'.repeat(255), experience: 'C'.repeat(255), location: 'Coimbatore', hrSourceId: 3, staffId: 12 };
    const response = await fetch(base + '/api/v1/hr/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidates: Array.from({ length: 500 }, () => row) }) });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ created: 500 });
  });
  it('keeps JSON parsing on normal candidate edits', async () => {
    const response = await fetch(base + '/api/v1/hr/12', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ city: 'Coimbatore', hrSourceId: 3 }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ city: 'Coimbatore', hrSourceId: 3 });
    expect(service.update).toHaveBeenCalledWith(12, expect.objectContaining({ city: 'Coimbatore', hrSourceId: 3 }), undefined);
  });
  it('keeps JSON parsing on normal candidate creation', async () => {
    const response = await fetch(base + '/api/v1/hr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Nandini Rao', mobile: '9876543210', department: 'Sales', position: 'Executive', hrSourceId: 3 }) });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ name: 'Nandini Rao', hrSourceId: 3 });
  });
  it('uploads actual multipart bytes and persists the real private reference', async () => {
    const body = new FormData(); body.append('file', new Blob(['%PDF-1.7 synthetic'], { type: 'application/pdf' }), 'candidate.pdf');
    const response = await fetch(base + '/api/v1/hr/7/upload/resume', { method: 'POST', body });
    expect(response.status).toBe(201); expect(await response.json()).toMatchObject({ success: true });
    expect(documents.upload).toHaveBeenCalledWith(7, 'resume', expect.objectContaining({ buffer: expect.any(Buffer) }));
    expect(service.saveDocument).toHaveBeenCalledWith(7, 'resume', 'hr-private://document-reference');
  });
  it('serves private document bytes with download and no-cache headers', async () => {
    const response = await fetch(base + '/api/v1/hr/7/documents/resume');
    expect(response.status).toBe(200); expect(await response.text()).toBe('%PDF-1.7 synthetic');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toContain('candidate.pdf');
  });
  it('rejects invalid candidate IDs and unsupported document slots', async () => {
    expect((await fetch(base + '/api/v1/hr/nope/documents/resume')).status).toBe(400);
    expect((await fetch(base + '/api/v1/hr/7/documents/other')).status).toBe(400);
  });

});
