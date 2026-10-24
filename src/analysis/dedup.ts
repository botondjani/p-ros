import type { Photo } from '../model/types';
import { hammingDistance } from './phash';

export interface DedupOptions {
  /** Ennyi bit eltérésig tekintünk két képet (majdnem) azonosnak. */
  maxHamming: number;
  /** Csak az ennyi percen belül készült képeket hasonlítjuk össze (dátum nélkül mindet). */
  windowMinutes: number;
}

export const DEFAULT_DEDUP: DedupOptions = { maxHamming: 6, windowMinutes: 10 };

/**
 * Duplikátumok és sorozatképek keresése. Időrendben, csúszó ablakkal
 * hasonlítunk; egy hasonló párból a jobb pontszámú marad meg, a másik
 * `duplicate` jelölést és `duplicateOf` hivatkozást kap.
 *
 * Visszaad egy térképet: duplikátum azonosítója → a megtartott kép azonosítója.
 */
export function findDuplicates(photos: Photo[], options: Partial<DedupOptions> = {}): Map<string, string> {
  const opts = { ...DEFAULT_DEDUP, ...options };
  const windowMs = opts.windowMinutes * 60_000;
  const sorted = [...photos].sort((a, b) => (a.takenAt ?? -Infinity) - (b.takenAt ?? -Infinity));
  const dupOf = new Map<string, string>();
  const keepers: Photo[] = [];

  const better = (a: Photo, b: Photo) =>
    a.quality.score !== b.quality.score ? a.quality.score > b.quality.score : a.width * a.height >= b.width * b.height;

  for (const p of sorted) {
    if (!p.quality.hash) {
      keepers.push(p);
      continue;
    }
    let match: Photo | undefined;
    for (let i = keepers.length - 1; i >= 0; i--) {
      const k = keepers[i];
      if (p.takenAt != null && k.takenAt != null && p.takenAt - k.takenAt > windowMs) break;
      if (!k.quality.hash) continue;
      if (hammingDistance(p.quality.hash, k.quality.hash) <= opts.maxHamming) {
        match = k;
        break;
      }
    }
    if (!match) {
      keepers.push(p);
      continue;
    }
    if (better(p, match)) {
      dupOf.set(match.id, p.id);
      keepers[keepers.indexOf(match)] = p;
      // ami eddig a régi megtartottra mutatott, most az újra mutasson
      for (const [d, k] of dupOf) if (k === match.id) dupOf.set(d, p.id);
    } else {
      dupOf.set(p.id, match.id);
    }
  }
  return dupOf;
}

/**
 * Duplikátum-jelölés alkalmazása helyben. A minőség miatt már kizárt
 * (sötét, életlen) vagy a user által kidobott képeket kihagyjuk, így azok
 * megtartják a pontosabb indoklást.
 */
export function applyDuplicates(photos: Photo[], options?: Partial<DedupOptions>): number {
  const candidates = photos.filter((p) => !p.excludedReason || p.excludedReason === 'notSelected');
  const dupOf = findDuplicates(candidates, options);
  for (const p of candidates) {
    const of = dupOf.get(p.id);
    if (of && p.excludedReason !== 'user') {
      p.excludedReason = 'duplicate';
      p.duplicateOf = of;
      p.included = false;
    }
  }
  return dupOf.size;
}
