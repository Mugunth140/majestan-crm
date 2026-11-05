import { cleanNavAccess, hasNavAccess } from './nav-access';

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

describe('hasNavAccess', () => {
  const user = (role: string, department: string, nav_access: string[] | null = null) => ({ role, department, nav_access });

  it('lets admins and managers into everything', () => {
    expect(hasNavAccess(user('Admin', ''), 'blog')).toBe(true);
    expect(hasNavAccess(user('Manager', ''), 'blog')).toBe(true);
  });

  it('follows the department defaults', () => {
    expect(hasNavAccess(user('Staff', 'Digital Department'), 'blog')).toBe(true);
    expect(hasNavAccess(user('Staff', 'Sales Department'), 'blog')).toBe(false);
  });

  it('follows the admin pick over the defaults', () => {
    expect(hasNavAccess(user('Staff', 'Sales Department', ['blog']), 'blog')).toBe(true);
    expect(hasNavAccess(user('Staff', 'Digital Department', []), 'blog')).toBe(false);
  });

  it('keeps management modules from staff even if ticked', () => {
    expect(hasNavAccess(user('Staff', 'Sales Department', ['analytics']), 'analytics')).toBe(false);
  });

  it('keeps legacy blog writers on the defaults', () => {
    expect(hasNavAccess({ ...user('Staff', 'Sales Department'), legacyBlog: true }, 'blog')).toBe(true);
  });
});
