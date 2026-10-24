import { describe, expect, it } from 'vitest';
import { pickHero, selectBest, targetCount } from '../src/analysis/select';
import { photo } from './helpers';

const T = new Date(2025, 4, 15, 9).getTime();
const MIN = 60_000;

describe('targetCount', () => {
  it('3 és 8 között, a képszám gyökével nő', () => {
    expect(targetCount(2)).toBe(2);
    expect(targetCount(4)).toBe(3);
    expect(targetCount(12)).toBe(6);
    expect(targetCount(200)).toBe(8);
  });
});

describe('selectBest', () => {
  it('a legjobb pontszámúakat választja, időrendben adja vissza', () => {
    const ps = [0.2, 0.9, 0.5, 0.8].map((score, i) =>
      photo({ takenAt: T + i * 30 * MIN, quality: { score, hash: (i * 0x1111).toString(16).padStart(16, '0') } }),
    );
    const sel = selectBest(ps);
    expect(sel).toHaveLength(3);
    expect(sel).toEqual([ps[1].id, ps[2].id, ps[3].id]);
  });

  it('sorozatképekből (2 percen belül, hasonló hash) csak egyet tesz be, ha van más jó kép', () => {
    const burst = [0.95, 0.94, 0.93].map((score, i) => photo({ takenAt: T + i * 5000, quality: { score, hash: 'aaaaaaaaaaaaaaaa' } }));
    const others = [0.7, 0.68].map((score, i) =>
      photo({ takenAt: T + (i + 1) * 60 * MIN, quality: { score, hash: i ? '0123456789abcdef' : 'fedcba9876543210' } }),
    );
    const sel = selectBest([...burst, ...others]);
    expect(sel.filter((id) => burst.some((b) => b.id === id))).toHaveLength(1);
    expect(sel).toContain(others[0].id);
    expect(sel).toContain(others[1].id);
  });

  it('nem választ életlen/sötét/duplikátum képet, ha van elég jó', () => {
    const good = [1, 2, 3, 4].map((i) => photo({ takenAt: T + i * 30 * MIN, quality: { score: 0.5, hash: `${i}`.repeat(16) } }));
    const bad = photo({ takenAt: T, excludedReason: 'blurry', quality: { score: 0.99 } });
    expect(selectBest([...good, bad])).not.toContain(bad.id);
  });

  it('ha kevés a jó kép, a kizártakkal (nem duplikátummal) tölt fel a minimumig', () => {
    const good = photo({ takenAt: T, quality: { score: 0.8, hash: '1111111111111111' } });
    const blurry = photo({ takenAt: T + MIN, excludedReason: 'blurry', quality: { score: 0.3 } });
    const dark = photo({ takenAt: T + 2 * MIN, excludedReason: 'dark', quality: { score: 0.2 } });
    const dup = photo({ takenAt: T + 3 * MIN, excludedReason: 'duplicate', quality: { score: 0.9 } });
    const sel = selectBest([good, blurry, dark, dup]);
    expect(sel).toEqual([good.id, blurry.id, dark.id]);
  });
});

describe('pickHero', () => {
  it('a legjobb pontszámút választja, kis előnnyel a fekvő képeknek', () => {
    const portrait = photo({ width: 3000, height: 4000, quality: { score: 0.82 } });
    const landscape = photo({ width: 4000, height: 3000, quality: { score: 0.78 } });
    expect(pickHero([portrait, landscape])).toBe(landscape.id);
    expect(pickHero([])).toBeUndefined();
  });
});
