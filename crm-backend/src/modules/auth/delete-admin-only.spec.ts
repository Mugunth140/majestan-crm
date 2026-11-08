import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

// Deleting records is for admins: every @Delete route must carry
// @Roles('Admin') with RolesGuard. The few below delete nothing shared — a
// user's own notifications, an attachment on their own unsent email, and the
// dashboard cache — so they stay open to everyone signed in.
const OPEN = new Set([
  "notifications/notifications.controller.ts @Delete('all')",
  "notifications/notifications.controller.ts @Delete(':id')",
  "mail/mail.controller.ts @Delete('attachments/:id')",
  "dashboard/dashboard.controller.ts @Delete('cache')",
]);

const MODULES = join(__dirname, '..');

function controllers(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return controllers(path);
    return /\.(controller|module)\.ts$/.test(name) ? [path] : [];
  });
}

/** Each @Delete route with the decorators on its method (and its class's guards). */
function deleteRoutes(file: string) {
  const source = readFileSync(file, 'utf8');
  const lines = source.split('\n');
  return lines.flatMap((line, i) => {
    const route = line.match(/@Delete\([^)]*\)/)?.[0];
    if (!route) return [];
    // The decorator stack around it: up and down to the method itself.
    let start = i;
    while (start > 0 && /^\s*@/.test(lines[start - 1])) start--;
    let end = i;
    while (end + 1 < lines.length && /^\s*@/.test(lines[end + 1])) end++;
    // The guards on the controller class this route sits in.
    const classGuards = source.slice(0, source.indexOf(line)).split(/^export class /m).slice(-2, -1)[0]?.match(/^@UseGuards\([^)]*\)/gm) ?? [];
    return [{ route, decorators: [...classGuards, ...lines.slice(start, end + 1)].join('\n') }];
  });
}

describe('delete routes', () => {
  const routes = controllers(MODULES).flatMap((file) =>
    deleteRoutes(file).map((r) => ({ ...r, key: `${relative(MODULES, file)} ${r.route}` })),
  );

  it('finds the delete routes', () => {
    expect(routes.length).toBeGreaterThan(30);
  });

  it.each(routes.filter((r) => !OPEN.has(r.key)).map((r) => [r.key, r.decorators]))(
    '%s is for admins only',
    (_key, decorators) => {
      expect(decorators).toMatch(/@Roles\('Admin'\)/);
      expect(decorators).toMatch(/@UseGuards\([^)]*RolesGuard/);
    },
  );

  it('keeps the open list current', () => {
    const keys = new Set(routes.map((r) => r.key));
    expect([...OPEN].filter((k) => !keys.has(k))).toEqual([]);
  });
});
