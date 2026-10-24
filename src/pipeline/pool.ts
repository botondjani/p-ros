import type { IngestRequest, IngestResponse } from './protocol';

/**
 * Egyszerű worker-pool: N worker, feladatsor, ígéret-alapú API. A képek
 * egyenként kerülnek a workerekbe, így a memóriában egyszerre csak N
 * dekódolt kép van.
 */
export class IngestPool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: { req: IngestRequest; resolve: (r: IngestResponse) => void }[] = [];
  private pending = new Map<Worker, (r: IngestResponse) => void>();

  constructor(size = IngestPool.defaultSize()) {
    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL('./ingest.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (ev: MessageEvent<IngestResponse>) => this.done(w, ev.data);
      w.onerror = (ev) => {
        ev.preventDefault();
        this.done(w, { ok: false, id: '', error: 'unknown', message: ev.message || 'worker hiba' });
      };
      this.workers.push(w);
      this.idle.push(w);
    }
  }

  static defaultSize() {
    const hc = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    return Math.max(2, Math.min(6, hc - 1));
  }

  run(req: IngestRequest): Promise<IngestResponse> {
    return new Promise((resolve) => {
      this.queue.push({ req, resolve });
      this.pump();
    });
  }

  private pump() {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop()!;
      const job = this.queue.shift()!;
      this.pending.set(w, (r) => job.resolve(r.id ? r : { ...r, id: job.req.id }));
      w.postMessage(job.req);
    }
  }

  private done(w: Worker, res: IngestResponse) {
    const cb = this.pending.get(w);
    this.pending.delete(w);
    this.idle.push(w);
    cb?.(res);
    this.pump();
  }

  terminate() {
    for (const w of this.workers) w.terminate();
    this.workers = [];
    this.idle = [];
  }
}
