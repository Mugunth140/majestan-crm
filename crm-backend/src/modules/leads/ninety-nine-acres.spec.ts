jest.mock('bun', () => ({ S3Client: class {} }), { virtual: true });
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { NinetyNineAcresController } from './ninety-nine-acres.controller';
import { NinetyNineAcresService } from './integrations/ninety-nine-acres.service';
import { NinetyNineAcresKeyGuard } from './guards/ninety-nine-acres-key.guard';
import { LeadsService } from './leads.service';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { ninetyNineAcresJsonParser } from '../../common/middleware/ninety-nine-acres-json';

describe('99acres push HTTP contract', () => {
  let app: INestApplication;
  const key = 'test-portal-key';
  const path = '/api/v1/leads/99acres';
  const row = { name: ' Ravi Kumar ', mobile: '+91 98765 43210', email: 'ravi@example.com', remarks: 'Enquiry from property portal' };
  const bulk = jest.fn();
  const findSource = jest.fn();
  const oldKey = process.env.NINETY_NINE_ACRES_API_KEY;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [NinetyNineAcresController], providers: [NinetyNineAcresService, NinetyNineAcresKeyGuard,
      { provide: getDataSourceToken(), useValue: { getRepository: () => ({ findOne: findSource }) } },
      { provide: LeadsService, useValue: { bulkCreateLeads: bulk } },
    ] }).compile();
    app = module.createNestApplication({ logger: false });
    app.use(path, ninetyNineAcresJsonParser);
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await app.init();
  });
  beforeEach(() => {
    process.env.NINETY_NINE_ACRES_API_KEY = key;
    bulk.mockReset().mockResolvedValue({ count: 1, created: 1, existing: 0, assigned: 0 });
    findSource.mockReset().mockResolvedValue({ id: 99, name: '99acres', is_active: true });
  });
  afterAll(async () => { await app.close(); jest.restoreAllMocks(); if (oldKey === undefined) delete process.env.NINETY_NINE_ACRES_API_KEY; else process.env.NINETY_NINE_ACRES_API_KEY = oldKey; });
  it('accepts minimal lead JSON and responds with counts after import, without requiring a login token', async () => {
    const response = await request(app.getHttpServer()).post(path).set('X-API-Key', key).send({ leads: [row] }).expect(200);
    expect(response.body).toEqual({ success: true, received: 1, created: 1, existing: 0 });
    expect(bulk).toHaveBeenCalledWith([expect.objectContaining({ name: 'Ravi Kumar', mobile: '9876543210', commissionRemarks: row.remarks, leadSourceId: 99 })], { role: 'Staff' });
    expect(findSource).toHaveBeenCalledWith({ where: { name: '99acres', is_active: true } });
  });
  it('ignores assignment, source IDs, and other internal bulk-import fields', async () => {
    await request(app.getHttpServer()).post(path).set('X-API-Key', key).send({ leads: [{ ...row, source: 'Website', assignedStaffId: 12, leadSourceId: -1, propertyType: 'apartment', commissionRemarks: 'Unwanted internal field' }] }).expect(200);
    expect(bulk.mock.calls[0][0][0]).toEqual({ name: 'Ravi Kumar', mobile: '9876543210', email: 'ravi@example.com', commissionRemarks: row.remarks, leadSourceId: 99 });
  });
  it('requires only name and mobile', async () => {
    await request(app.getHttpServer()).post(path).set('X-API-Key', key).send({ leads: [{ name: 'Ravi', mobile: '9876543210' }] }).expect(200);
    expect(bulk.mock.calls[0][0][0]).toMatchObject({ name: 'Ravi', mobile: '9876543210', email: undefined, commissionRemarks: undefined });
  });
  it.each([undefined, null, '', '   '])('allows omitted or empty optional email and remarks: %s', async value => {
    await request(app.getHttpServer()).post(path).set('X-API-Key', key).send({ leads: [{ ...row, email: value, remarks: value }] }).expect(200);
  });
  it('trims and maps optional remarks to the initial lead note', async () => {
    await request(app.getHttpServer()).post(path).set('X-API-Key', key).send({ leads: [{ ...row, remarks: '  Please call after 6 pm  ' }] }).expect(200);
    expect(bulk.mock.calls[0][0][0].commissionRemarks).toBe('Please call after 6 pm');
  });
  it.each([undefined, 'incorrect-key'])('rejects missing/incorrect integration keys', async value => {
    const call = request(app.getHttpServer()).post(path); if (value) call.set('X-API-Key', value);
    await call.send({ leads: [row] }).expect(401); expect(bulk).not.toHaveBeenCalled(); expect(findSource).not.toHaveBeenCalled();
  });
  it('does not accept the website key header', async () => {
    await request(app.getHttpServer()).post(path).set('X-Service-Key', key).send({ leads: [row] }).expect(401);
  });
  it('fails closed when the backend key is unset', async () => {
    delete process.env.NINETY_NINE_ACRES_API_KEY;
    await request(app.getHttpServer()).post(path).set('X-API-Key', key).send({ leads: [row] }).expect(503);
    expect(bulk).not.toHaveBeenCalled();
  });
  it('fails closed when the source is missing or inactive', async () => {
    findSource.mockResolvedValue(null);
    await request(app.getHttpServer()).post(path).set('X-API-Key', key).send({ leads: [row] }).expect(503); expect(bulk).not.toHaveBeenCalled();
  });
  it.each([{}, { leads: [] }, { leads: [null] }, { leads: [{}] }, { leads: [{ ...row, name: ' ' }] },
    { leads: [{ ...row, mobile: 'abc9876543210' }] }, { leads: [{ ...row, mobile: '123' }] },
    { leads: [{ ...row, email: 'invalid' }] }, { leads: Array(101).fill(row) }, { leads: [{ ...row, remarks: 'x'.repeat(2001) }] }, { leads: [{ ...row, remarks: 123 }] },
  ])('rejects invalid envelopes/rows atomically', async body => {
    await request(app.getHttpServer()).post(path).set('X-API-Key', key).send(body).expect(400); expect(bulk).not.toHaveBeenCalled();
  });
  it('accepts up to 100 rows and normalizes trunk prefixes', async () => {
    await request(app.getHttpServer()).post(path).set('X-API-Key', key).send({ leads: Array(100).fill({ ...row, mobile: '09876543210' }) }).expect(200);
    expect(bulk.mock.calls[0][0]).toHaveLength(100); expect(bulk.mock.calls[0][0][0].mobile).toBe('9876543210');
  });
  it('rejects malformed JSON using the production exception filter', async () => {
    await request(app.getHttpServer()).post(path).set('X-API-Key', key).set('Content-Type', 'application/json').send('{invalid').expect(400);
    expect(bulk).not.toHaveBeenCalled();
  });
  it('rejects oversized bodies', async () => {
    await request(app.getHttpServer()).post(path).set('X-API-Key', key).send({ leads: [{ ...row, notes: 'x'.repeat(513*1024) }] }).expect(413); expect(bulk).not.toHaveBeenCalled();
  });
  it('reports existing mobiles using the bulk importer result, without leaking contact records', async () => {
    bulk.mockResolvedValue({ count: 0, created: 0, existing: 1, assigned: 0 });
    const response = await request(app.getHttpServer()).post(path).set('X-API-Key', key).send({ leads: [row] }).expect(200);
    expect(response.body.existing).toBe(1); expect(response.body).not.toHaveProperty('data');
  });
  it('does not acknowledge persistence failures as accepted', async () => {
    bulk.mockRejectedValue(new Error('Test persistence failure'));
    const logger = jest.spyOn(console, 'error').mockImplementation(() => {});
    try { await request(app.getHttpServer()).post(path).set('X-API-Key', key).send({ leads: [row] }).expect(500); }
    finally { logger.mockRestore(); }
  });
});
