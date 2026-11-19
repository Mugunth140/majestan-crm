import { describeRefusedKey, keyMatches } from './guards/portal-key.guard';
import { asLeadsEnvelope, bodyShape } from '../../common/middleware/portal-json';

describe('portal push logging', () => {
  const key = 'sk-Abcdefghij0123456789';

  it('describes a refused key without any part of it', () => {
    const d = describeRefusedKey({ 'x-api-key': ` Bearer ${key} `, 'x-source-id': 'lms' }, key);
    expect(d).toMatchObject({ sent: 'x-api-key', hasSpaces: true, hasBearer: true, matchesOnceCleaned: true, startsLikeOurs: false });
    expect(JSON.stringify(d)).not.toContain(key.slice(3, 10));
  });

  it('spots the key sent as Authorization instead', () => {
    const d = describeRefusedKey({ authorization: `Bearer ${key}` }, key);
    expect(d).toMatchObject({ sent: 'none', authorizationMatches: true, keyHeaders: ['authorization'] });
  });

  it('says plainly when it is simply a different key', () => {
    expect(describeRefusedKey({ 'x-api-key': 'sk-other' }, key)).toMatchObject({ startsLikeOurs: true, matchesOnceCleaned: false, length: 8 });
  });

  it('keeps the layout of a body and drops every value', () => {
    const shape = bodyShape({ lead: { name: 'Ravi', phone: 9876543210, extra: null }, leads: [{ a: 'x' }, { a: 'y' }] });
    expect(shape).toEqual({ lead: { name: 'string', phone: 'number', extra: 'null' }, leads: [{ a: 'string' }, 'x2'] });
    expect(JSON.stringify(shape)).not.toMatch(/Ravi|9876/);
  });

  it('accepts the key with or without its sk- prefix, and nothing else', () => {
    expect(keyMatches(key, key)).toBe(true);
    expect(keyMatches(key.slice(3), key)).toBe(true);
    expect(keyMatches(key.slice(4), key)).toBe(false);
    expect(keyMatches('sk-' + key, key)).toBe(false);
    expect(keyMatches('', key)).toBe(false);
  });

  it('wraps a single lead or a bare list, and leaves other bodies alone', () => {
    expect(asLeadsEnvelope({ name: 'R', mobile: '1' })).toEqual({ leads: [{ name: 'R', mobile: '1' }] });
    expect(asLeadsEnvelope([{ a: 1 }])).toEqual({ leads: [{ a: 1 }] });
    expect(asLeadsEnvelope({ leads: [] })).toEqual({ leads: [] });
    expect(asLeadsEnvelope({})).toEqual({});
  });
});
