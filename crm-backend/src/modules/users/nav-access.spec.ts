import { cleanNavAccess } from './nav-access';

describe('cleanNavAccess', () => {
  it('keeps known modules once', () => {
    expect(cleanNavAccess(['leads', 'leads', 'tasks'])).toEqual(['leads', 'tasks']);
  });

  it('drops unknown keys', () => {
    expect(cleanNavAccess(['leads', 'nope', 3])).toEqual(['leads']);
  });

  it('treats anything but a list as back to defaults', () => {
    expect(cleanNavAccess(null)).toBeNull();
    expect(cleanNavAccess('leads')).toBeNull();
  });

  it('keeps an empty list (nothing but the dashboard)', () => {
    expect(cleanNavAccess([])).toEqual([]);
  });
});
