import type { Photo } from '../model/types';
import { hammingDistance } from './phash';

export interface SelectOptions {
  min: number;
  max: number;
}

const DEFAULTS: SelectOptions = { min: 3, max: 8 };
const QUALITY_REJECTS = new Set(['duplicate', 'blurry', 'dark']);

/** Hány képet mutassunk egy fejezetben: a képszám gyökével arányos, 3–8 között. */
export function targetCount(total: number, opts: SelectOptions = DEFAULTS): number {
  if (total <= opts.min) return total;
  return Math.max(opts.min, Math.min(opts.max, Math.round(Math.sqrt(total) * 1.6)));
}

/**
 * Egy fejezet legjobb képeinek kiválasztása. Mohó algoritmus: mindig a
 * legjobb pontszámú képet vesszük, de büntetjük, ha időben (2 percen belül)
 * vagy látványban (hasonló hash) túl közel van egy már kiválasztotthoz, így
 * a sorozatképekből csak egy kerül be.
 *
 * Ha a minőségszűrés túl sokat dobott ki, a kizárt (de nem duplikátum)
 * képekkel töltjük fel a minimumig. Az eredmény időrendben van.
 */
export function selectBest(photos: Photo[], opts: SelectOptions = DEFAULTS): string[] {
  const good = photos.filter((p) => !p.excludedReason || !QUALITY_REJECTS.has(p.excludedReason));
  const n = targetCount(photos.length, opts);
  const picked: Photo[] = [];
  const pool = [...good];

  const sameBurst = (p: Photo, q: Photo) =>
    p.takenAt != null && q.takenAt != null && Math.abs(p.takenAt - q.takenAt) < 120_000 && hammingDistance(p.quality.hash, q.quality.hash) <= 10;

  while (picked.length < n && pool.length) {
    let bestIdx = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      // ugyanabból a sorozatból csak akkor kerül be második kép, ha a minimumhoz kell
      if (picked.length >= opts.min && picked.some((q) => sameBurst(p, q))) continue;
      let penalty = 0;
      for (const q of picked) {
        if (p.takenAt != null && q.takenAt != null && Math.abs(p.takenAt - q.takenAt) < 120_000) penalty += 0.25;
        const hd = hammingDistance(p.quality.hash, q.quality.hash);
        if (hd < 14) penalty += 0.35 * (1 - hd / 14);
      }
      const s = p.quality.score - penalty;
      if (s > bestScore) {
        bestScore = s;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) break;
    picked.push(pool.splice(bestIdx, 1)[0]);
  }

  if (picked.length < Math.min(opts.min, photos.length)) {
    const fill = photos
      .filter((p) => !picked.includes(p) && p.excludedReason !== 'duplicate')
      .sort((a, b) => b.quality.score - a.quality.score);
    while (picked.length < Math.min(opts.min, photos.length) && fill.length) picked.push(fill.shift()!);
  }

  return picked.sort((a, b) => (a.takenAt ?? 0) - (b.takenAt ?? 0)).map((p) => p.id);
}

/** Kiemelt kép: a legjobb pontszámú, lehetőleg fekvő tájolású a kiválasztottak közül. */
export function pickHero(photos: Photo[]): string | undefined {
  let best: Photo | undefined;
  let bestScore = -Infinity;
  for (const p of photos) {
    const landscape = p.width >= p.height ? 0.08 : 0;
    const s = p.quality.score + landscape;
    if (s > bestScore) {
      bestScore = s;
      best = p;
    }
  }
  return best?.id;
}
