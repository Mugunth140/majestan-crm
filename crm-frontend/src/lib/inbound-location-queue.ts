export type InboundCoordinates = { latitude: number; longitude: number };
type PendingLocation = { id: number; capture: string; ready: boolean; coordinates?: InboundCoordinates };
type Capture = { scope: string; coordinates?: InboundCoordinates; requesting: boolean; active: boolean };

type LocationDependencies = {
  identity: () => string | null;
  load: (scope: string) => PendingLocation[];
  store: (scope: string, jobs: PendingLocation[]) => void;
  locate: () => Promise<InboundCoordinates>;
  save: (id: number, coordinates: InboundCoordinates) => Promise<void>;
  notify: (message: string, retry: () => void) => void;
  complete?: () => void;
};

/** Outbox lives outside the form so GPS and network retries survive route changes. */
export class InboundLocationQueue {
  private scope: string | null = null;
  private jobs: PendingLocation[] = [];
  private captures = new Map<string, Capture>();
  private syncing = false;
  private sequence = 0;

  constructor(private readonly dependencies: LocationDependencies) {}

  private restore() {
    const scope = this.dependencies.identity();
    if (scope === this.scope) return;
    this.scope = scope;
    this.captures.clear();
    this.jobs = scope ? this.dependencies.load(scope).map(job => ({ ...job, ready: true })) : [];
  }
  private persist() {
    if (this.scope) this.dependencies.store(this.scope, this.jobs);
  }

  startCapture(): string {
    this.restore();
    if (!this.scope) return '';
    const capture = `${Date.now()}-${++this.sequence}`;
    this.captures.set(capture, { scope: this.scope, requesting: false, active: true });
    void this.request(capture);
    return capture;
  }

  stopCapture(capture: string) {
    const state = this.captures.get(capture);
    if (state) state.active = false;
    if (!this.jobs.length && ![...this.captures.values()].some(item => item.active && !item.coordinates)) this.dependencies.complete?.();
  }

  enqueue(capture: string, id: number, waitForPhoto: boolean) {
    this.restore();
    if (!Number.isSafeInteger(id) || id <= 0 || !this.scope) return;
    const state = this.captures.get(capture);
    this.jobs.push({ id, capture, ready: !waitForPhoto, coordinates: state?.coordinates });
    this.persist();
    if (!state?.coordinates) void this.request(capture);
    void this.flush();
  }

  photoFinished(id: number, hasLocation = false) {
    if (hasLocation) this.jobs = this.jobs.filter(job => job.id !== id);
    for (const job of this.jobs) if (job.id === id) job.ready = true;
    this.persist();
    void this.flush();
  }

  retry() {
    this.restore();
    const captures = new Set(this.jobs.filter(job => !job.coordinates).map(job => job.capture));
    for (const [key, state] of this.captures) if (state.active && !state.coordinates) captures.add(key);
    for (const key of captures) void this.request(key);
    void this.flush();
  }

  private async request(key: string) {
    if (!this.scope) return;
    let state = this.captures.get(key);
    if (!state) {
      state = { scope: this.scope, requesting: false, active: false };
      this.captures.set(key, state);
    }
    if (state.requesting || state.coordinates) return;
    state.requesting = true;
    try {
      const coordinates = await this.dependencies.locate();
      if (state.scope !== this.dependencies.identity()) return;
      if (!Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)
        || Math.abs(coordinates.latitude) > 90 || Math.abs(coordinates.longitude) > 180) throw new Error('Invalid location');
      state.coordinates = coordinates;
      for (const job of this.jobs) if (job.capture === key) job.coordinates = coordinates;
      this.persist();
      void this.flush();
    } catch {
      if (state.scope === this.dependencies.identity() && (state.active || this.jobs.some(job => job.capture === key))) {
        this.dependencies.notify('Location is needed. Allow Location in this app’s settings, then retry. Inbound creation can continue.', () => this.retry());
      }
    } finally {
      state.requesting = false;
    }
  }

  private async flush() {
    if (this.syncing) return;
    this.syncing = true;
    try {
      for (const job of [...this.jobs]) {
        if (!job.ready || !job.coordinates || this.scope !== this.dependencies.identity()) continue;
        try {
          await this.dependencies.save(job.id, job.coordinates);
          this.jobs = this.jobs.filter(item => item !== job);
          this.persist();
        } catch {
          this.dependencies.notify('Inbound saved. Its location is pending and will retry when the connection returns.', () => this.retry());
        }
      }
      if (!this.jobs.length && ![...this.captures.values()].some(state => state.active && !state.coordinates)) this.dependencies.complete?.();
    } finally {
      this.syncing = false;
    }
  }
}
