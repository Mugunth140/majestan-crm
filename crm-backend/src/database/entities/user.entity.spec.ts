import { User, fullUser } from './user.entity';

describe('User serialisation', () => {
  const user = Object.assign(new User(), {
    id: 7, name: 'Tele Staff', email: 'tele@example.com', password_hash: '$2b$10$secret',
    aadhaar_no: '1234 5678 9012', bank_account_no: '000111222', phone: '9876543210', dob: '1990-01-01',
    role_id: 3, department_id: 2, is_active: true,
  });

  it('never puts the password hash or personal details in a response', () => {
    const json = JSON.parse(JSON.stringify({ follow_ups: [{ created_by: user }] }));
    expect(json.follow_ups[0].created_by).toEqual({ id: 7, name: 'Tele Staff', email: 'tele@example.com', role_id: 3, department_id: 2, is_active: true, avatar_url: null });
  });

  it('keeps every field but the hash for the admin Users screens', () => {
    const full = JSON.parse(JSON.stringify(fullUser(user)));
    expect(full.password_hash).toBeUndefined();
    expect(full.aadhaar_no).toBe('1234 5678 9012');
    expect(full.phone).toBe('9876543210');
  });
});
