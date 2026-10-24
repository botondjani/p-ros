import type { GeoPoint } from '../model/types';
import { centroid, haversineKm } from './geo';

export interface ClusterInput {
  id: string;
  takenAt: number | null;
  gps?: GeoPoint;
}

export interface ClusterOptions {
  /** Ennél nagyobb időbeli rés új eseményt kezd. */
  maxGapHours: number;
  /** Ennél nagyobb elmozdulás (két GPS-es kép között) új eseményt kezd. */
  maxDistanceKm: number;
  /** Hely nélküli esemény ennyi órán belül a szomszédos, helyes eseményhez olvad. */
  inferWindowHours: number;
  /** Ennél több fejezet esetén napokra, hetekre, majd hónapokra vonunk össze. */
  maxChapters: number;
}

export const DEFAULT_CLUSTER_OPTIONS: ClusterOptions = {
  maxGapHours: 6,
  maxDistanceKm: 30,
  inferWindowHours: 12,
  maxChapters: 12,
};

export type Granularity = 'event' | 'day' | 'week' | 'month';

export interface PhotoGroup {
  photoIds: string[];
  start: number;
  end: number;
  center?: GeoPoint;
  /** Igaz, ha a csoportban egyetlen képnek sincs (becsült) helye. */
  placeless: boolean;
}

export interface ClusterResult {
  groups: PhotoGroup[];
  granularity: Granularity;
  /** Dátum nélküli képek; ezek külön fejezetbe kerülnek. */
  undated: string[];
  /** Képek, amelyek a fejezetük helyét kapták meg becslésként. */
  inferredGps: Record<string, GeoPoint>;
}

interface WorkGroup {
  items: ClusterInput[];
  start: number;
  end: number;
}

const HOUR = 3_600_000;

function lastGps(g: WorkGroup): GeoPoint | undefined {
  for (let i = g.items.length - 1; i >= 0; i--) if (g.items[i].gps) return g.items[i].gps;
  return undefined;
}

function firstGps(g: WorkGroup): GeoPoint | undefined {
  for (const it of g.items) if (it.gps) return it.gps;
  return undefined;
}

function hasGps(g: WorkGroup) {
  return g.items.some((it) => it.gps);
}

function merge(a: WorkGroup, b: WorkGroup): WorkGroup {
  return { items: [...a.items, ...b.items], start: Math.min(a.start, b.start), end: Math.max(a.end, b.end) };
}

/** 1. lépés: időrendben végigmenve eseményekre vágás idő- és távolságrés alapján. */
export function splitEvents(dated: ClusterInput[], opts: ClusterOptions): WorkGroup[] {
  const sorted = [...dated].sort((a, b) => a.takenAt! - b.takenAt!);
  const groups: WorkGroup[] = [];
  let cur: WorkGroup | null = null;
  for (const it of sorted) {
    const t = it.takenAt!;
    if (cur) {
      const gapTooBig = t - cur.end > opts.maxGapHours * HOUR;
      const prev = lastGps(cur);
      const movedTooFar = !!(prev && it.gps && haversineKm(prev, it.gps) > opts.maxDistanceKm);
      if (!gapTooBig && !movedTooFar) {
        cur.items.push(it);
        cur.end = t;
        continue;
      }
    }
    cur = { items: [it], start: t, end: t };
    groups.push(cur);
  }
  return groups;
}

/**
 * 2. lépés: a hely nélküli eseményeket az időben legközelebbi, helyes
 * eseményhez olvasztjuk, ha az `inferWindowHours`-on belül van.
 */
export function absorbPlaceless(groups: WorkGroup[], opts: ClusterOptions): WorkGroup[] {
  const out = [...groups];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      if (hasGps(out[i])) continue;
      const prev = i > 0 && hasGps(out[i - 1]) ? out[i].start - out[i - 1].end : Infinity;
      const next = i < out.length - 1 && hasGps(out[i + 1]) ? out[i + 1].start - out[i].end : Infinity;
      const best = Math.min(prev, next);
      if (best > opts.inferWindowHours * HOUR) continue;
      if (prev <= next) {
        out.splice(i - 1, 2, merge(out[i - 1], out[i]));
      } else {
        out.splice(i, 2, merge(out[i], out[i + 1]));
      }
      changed = true;
      break;
    }
  }
  return out;
}

/**
 * 3. lépés: az egyképes eseményeket a közelebbi szomszédhoz olvasztjuk, ha
 * 24 órán belül van és nincs messze; így nem lesz minden elkószált kép
 * külön fejezet.
 */
export function absorbSingletons(groups: WorkGroup[], opts: ClusterOptions): WorkGroup[] {
  const out = [...groups];
  const near = (a: WorkGroup, b: WorkGroup) => {
    const pa = lastGps(a);
    const pb = firstGps(b);
    return !pa || !pb || haversineKm(pa, pb) <= opts.maxDistanceKm * 3;
  };
  for (let i = 0; i < out.length && out.length > 1; i++) {
    if (out[i].items.length !== 1) continue;
    const prevGap = i > 0 && near(out[i - 1], out[i]) ? out[i].start - out[i - 1].end : Infinity;
    const nextGap = i < out.length - 1 && near(out[i], out[i + 1]) ? out[i + 1].start - out[i].end : Infinity;
    if (Math.min(prevGap, nextGap) > 24 * HOUR) continue;
    if (prevGap <= nextGap) out.splice(i - 1, 2, merge(out[i - 1], out[i]));
    else out.splice(i, 2, merge(out[i], out[i + 1]));
    i = Math.max(-1, i - 2);
  }
  return out;
}

function groupKey(t: number, g: Granularity): string {
  const d = new Date(t);
  if (g === 'day') return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  if (g === 'month') return `${d.getFullYear()}-${d.getMonth()}`;
  // ISO-szerű hét: hétfőhöz igazítva
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
}

/** 4. lépés: ha túl sok az esemény, egyre durvább időegységekbe vonjuk őket. */
export function coarsen(groups: WorkGroup[], opts: ClusterOptions): { groups: WorkGroup[]; granularity: Granularity } {
  if (groups.length <= opts.maxChapters) return { groups, granularity: 'event' };
  const levels: Granularity[] = ['day', 'week', 'month'];
  let result = groups;
  for (const level of levels) {
    const merged: WorkGroup[] = [];
    let lastKey = '';
    for (const g of groups) {
      const key = groupKey(g.start, level);
      if (merged.length && key === lastKey) merged[merged.length - 1] = merge(merged[merged.length - 1], g);
      else merged.push({ ...g, items: [...g.items] });
      lastKey = key;
    }
    result = merged;
    if (merged.length <= opts.maxChapters) return { groups: merged, granularity: level };
  }
  return { groups: result, granularity: 'month' };
}

export function clusterPhotos(items: ClusterInput[], options: Partial<ClusterOptions> = {}): ClusterResult {
  const opts = { ...DEFAULT_CLUSTER_OPTIONS, ...options };
  const dated = items.filter((it) => it.takenAt != null && Number.isFinite(it.takenAt));
  const undated = items.filter((it) => !(it.takenAt != null && Number.isFinite(it.takenAt))).map((it) => it.id);

  let groups = splitEvents(dated, opts);
  groups = absorbPlaceless(groups, opts);
  groups = absorbSingletons(groups, opts);
  const coarse = coarsen(groups, opts);

  const inferredGps: Record<string, GeoPoint> = {};
  const out: PhotoGroup[] = coarse.groups.map((g) => {
    const center = centroid(g.items.filter((it) => it.gps).map((it) => it.gps!));
    if (center && coarse.granularity === 'event') {
      for (const it of g.items) if (!it.gps) inferredGps[it.id] = center;
    }
    return {
      photoIds: g.items.map((it) => it.id),
      start: g.start,
      end: g.end,
      center,
      placeless: !center,
    };
  });

  return { groups: out, granularity: coarse.granularity, undated, inferredGps };
}
