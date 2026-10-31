import { HrDocumentsService } from './hr-documents.service';
import { HrController, HrDocumentType } from './hr.controller';
class MemoryDocuments extends HrDocumentsService {
 objects = new Map<string, Buffer>();
 protected async storage(): Promise<any> { return { write: async (key: string, bytes: Buffer) => { this.objects.set(key, bytes); }, delete: async (key: string) => { this.objects.delete(key); }, file: (key: string) => ({ exists: async () => this.objects.has(key), arrayBuffer: async () => this.objects.get(key)! }) }; }
}
const file = { originalname: '../../candidate.pdf', buffer: Buffer.from('%PDF-1.7 private candidate document'), mimetype: 'application/pdf' } as Express.Multer.File;
describe('private HR documents', () => {
 let oldKey: string | undefined;
 beforeEach(() => { oldKey = process.env.HR_DOCUMENT_ENCRYPTION_KEY; process.env.HR_DOCUMENT_ENCRYPTION_KEY = 'synthetic-test-encryption-key'; });
 afterEach(() => { if (oldKey === undefined) delete process.env.HR_DOCUMENT_ENCRYPTION_KEY; else process.env.HR_DOCUMENT_ENCRYPTION_KEY = oldKey; });
 it('stores encrypted bytes and reads the original through the private service', async () => {
  const docs = new MemoryDocuments(); const ref = await docs.upload(7, 'resume', file);
  const stored = [...docs.objects.values()][0];
  expect(ref).toMatch(/^hr-private:\/\/hr-documents\/v1\/7\/resume\//);
  expect(stored.includes(file.buffer)).toBe(false); expect(stored.includes(Buffer.from('candidate.pdf'))).toBe(false);
  expect(await docs.read(7, 'resume', ref)).toMatchObject({ buffer: file.buffer, contentType: 'application/pdf', filename: 'candidate.pdf' });
 });
 it('does not serve another candidate or document slot', async () => {
  const docs = new MemoryDocuments(); const ref = await docs.upload(7, 'resume', file);
  await expect(docs.read(8, 'resume', ref)).rejects.toThrow('No stored'); await expect(docs.read(7, 'aadhaar', ref)).rejects.toThrow('No stored');
 });
 it('rejects corrupt, executable, oversized and non-photo uploads', async () => {
  const docs = new MemoryDocuments();
  await expect(docs.upload(7, 'resume', { ...file, buffer: Buffer.from('<script>bad</script>') })).rejects.toThrow('Choose a PDF');
  await expect(docs.upload(7, 'resume', { ...file, buffer: Buffer.alloc(10 * 1024 * 1024 + 1) })).rejects.toThrow('10 MB');
  await expect(docs.upload(7, 'photo', file)).rejects.toThrow('photo');
  expect(docs.objects.size).toBe(0);
 });
 it('never writes a candidate URL when the object upload fails', async () => {
  const hr: any = { findOne: jest.fn(async () => ({ id: 7 })), saveDocument: jest.fn() };
  const docs: any = { upload: jest.fn(async () => { throw new Error('Storage unavailable'); }), discard: jest.fn() };
  await expect(new HrController(hr, docs).uploadDocument(7, HrDocumentType.RESUME, file)).rejects.toThrow('Storage unavailable');
  expect(hr.saveDocument).not.toHaveBeenCalled();
 });
 it('removes the newly uploaded object only when persistence is confirmed not to reference it', async () => {
  const hr: any = { findOne: jest.fn(async () => ({ id: 7 })), saveDocument: jest.fn(async () => { throw new Error('Database failed'); }) };
  const docs: any = { upload: jest.fn(async () => 'hr-private://new-key'), discard: jest.fn(async () => {}) };
  await expect(new HrController(hr, docs).uploadDocument(7, HrDocumentType.RESUME, file)).rejects.toThrow('Database failed');
  expect(docs.discard).toHaveBeenCalledWith('hr-private://new-key');
 });
});

it('keeps an uploaded object after an ambiguous database acknowledgement',async()=>{
 const reference='hr-private://persisted-key';
 const hr:any={findOne:jest.fn().mockResolvedValueOnce({id:7}).mockResolvedValueOnce({id:7,resumeUrl:reference}),saveDocument:jest.fn(async()=>{throw new Error('Acknowledgement lost');})};
 const docs:any={upload:jest.fn(async()=>reference),discard:jest.fn()};
 await expect(new HrController(hr,docs).uploadDocument(7,HrDocumentType.RESUME,file)).rejects.toThrow('Acknowledgement lost');
 expect(docs.discard).not.toHaveBeenCalled();
});
