import { describe, expect, it, vi } from 'vitest';
import { InboundLocationQueue, type InboundCoordinates } from './inbound-location-queue';
const coordinates = { latitude: 0, longitude: 76.95 };
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function setup() {
  let user = 'staff-1';
  const persisted = new Map<string, unknown>();
  const fix = deferred<InboundCoordinates>();
  const dependencies = {
    identity: () => user,
    load: (scope: string) => JSON.parse(JSON.stringify(persisted.get(scope) || [])),
    store: (scope: string, jobs: unknown) => { persisted.set(scope, JSON.parse(JSON.stringify(jobs))); },
    locate: vi.fn(() => fix.promise),
    save: vi.fn<(id: number, coordinates: InboundCoordinates) => Promise<void>>().mockResolvedValue(undefined),
    notify: vi.fn(), complete: vi.fn(),
  };
  const queue = new InboundLocationQueue(dependencies);
  return { queue, fix, dependencies, persisted, switchUser: () => { user = 'staff-2'; } };
}
describe('background inbound location outbox', () => {
  it('does not wait for permission or GPS to register a created inbound', async () => {
    const { queue, fix, dependencies } = setup();
    const capture = queue.startCapture();
    expect(queue.enqueue(capture, 12, false)).toBeUndefined();
    expect(dependencies.save).not.toHaveBeenCalled();
    fix.resolve(coordinates);
    await tick();
    expect(dependencies.save).toHaveBeenCalledWith(12, coordinates);
  });
  it('finishes location after navigation away from the form', async () => {
    const { queue, fix, dependencies } = setup();
    const capture = queue.startCapture(); queue.enqueue(capture, 12, false);
    queue.stopCapture(capture);
    fix.resolve(coordinates); await tick();
    expect(dependencies.save).toHaveBeenCalledWith(12, coordinates);
  });
  it('waits for photo metadata and drops the fallback when the photo supplies GPS', async () => {
    const { queue, fix, dependencies, persisted } = setup();
    const capture = queue.startCapture(); queue.enqueue(capture, 12, true);
    fix.resolve(coordinates); await tick();
    expect(dependencies.save).not.toHaveBeenCalled();
    queue.photoFinished(12, true); await tick();
    expect(dependencies.save).not.toHaveBeenCalled();
    expect(persisted.get('staff-1')).toEqual([]);
  });
  it('saves device GPS when photo metadata has no location', async () => {
    const { queue, fix, dependencies } = setup();
    const capture = queue.startCapture(); queue.enqueue(capture, 12, true);
    fix.resolve(coordinates); await tick();
    queue.photoFinished(12); await tick();
    expect(dependencies.save).toHaveBeenCalledWith(12, coordinates);
  });
  it('keeps denied requests pending and offers a permission retry', async () => {
    const { queue, fix, dependencies, persisted } = setup();
    const capture = queue.startCapture(); queue.enqueue(capture, 12, false);
    fix.reject(new Error('Denied')); await tick();
    expect(dependencies.notify).toHaveBeenCalledWith(expect.stringContaining('settings'), expect.any(Function));
    expect(persisted.get('staff-1')).toEqual([expect.objectContaining({ id: 12 })]);
    dependencies.locate.mockResolvedValue(coordinates);
    dependencies.notify.mock.calls[0][1](); await tick();
    expect(dependencies.save).toHaveBeenCalledWith(12, coordinates);
  });
  it('persists a failed location update and retries it after app reload', async () => {
    const { queue, fix, dependencies, persisted } = setup();
    dependencies.save.mockRejectedValueOnce(new Error('Offline'));
    const capture = queue.startCapture(); queue.enqueue(capture, 12, false);
    fix.resolve(coordinates); await tick();
    expect(persisted.get('staff-1')).toEqual([expect.objectContaining({ id: 12, coordinates })]);
    const reloaded = new InboundLocationQueue(dependencies);
    reloaded.retry(); await tick();
    expect(dependencies.save).toHaveBeenCalledTimes(2);
    expect(persisted.get('staff-1')).toEqual([]);
  });
  it('does not attach a prior user’s coordinates after an account switch', async () => {
    const { queue, fix, dependencies, switchUser } = setup();
    const capture = queue.startCapture(); queue.enqueue(capture, 12, false);
    switchUser(); fix.resolve(coordinates); await tick();
    expect(dependencies.save).not.toHaveBeenCalled();
  });
});
