import { describe, expect, it } from 'vitest';
import { applyDuplicates, findDuplicates } from '../src/analysis/dedup';
import { photo } from './helpers';

const T = new Date(2025, 4, 15, 12).getTime();
const MIN = 60_000;

describe('findDuplicates', () => {
  it('az időben közeli, hasonló hash-ű képekből a jobbat tartja meg', () => {
    const a = photo({ takenAt: T, quality: { hash: 'f0f0f0f0f0f0f0f0', score: 0.6 } });
    const b = photo({ takenAt: T + 5_000, quality: { hash: 'f0f0f0f0f0f0f0f1', score: 0.9 } });
    const dup = findDuplicates([a, b]);
    expect(dup.get(a.id)).toBe(b.id);
    expect(dup.has(b.id)).toBe(false);
  });

  it('hasonló, de időben távoli képet nem tekint duplikátumnak', () => {
    const a = photo({ takenAt: T, quality: { hash: 'f0f0f0f0f0f0f0f0' } });
    const b = photo({ takenAt: T + 60 * MIN, quality: { hash: 'f0f0f0f0f0f0f0f0' } });
    expect(findDuplicates([a, b]).size).toBe(0);
  });

  it('eltérő képeket nem von össze', () => {
    const a = photo({ takenAt: T, quality: { hash: 'f0f0f0f0f0f0f0f0' } });
    const b = photo({ takenAt: T + MIN, quality: { hash: '0f0f0f0f0f0f0f0f' } });
    expect(findDuplicates([a, b]).size).toBe(0);
  });

  it('sorozatból egyet tart meg, és minden duplikátum a megtartottra mutat', () => {
    const burst = [0.5, 0.7, 0.95, 0.6].map((score, i) =>
      photo({ takenAt: T + i * 1000, quality: { hash: i % 2 ? 'aaaaaaaaaaaaaaab' : 'aaaaaaaaaaaaaaaa', score } }),
    );
    const dup = findDuplicates(burst);
    expect(dup.size).toBe(3);
    for (const v of dup.values()) expect(v).toBe(burst[2].id);
  });

  it('egyforma pontszámnál a nagyobb felbontású marad', () => {
    const small = photo({ takenAt: T, width: 1000, height: 750, quality: { hash: 'aaaaaaaaaaaaaaaa', score: 0.8 } });
    const big = photo({ takenAt: T + 1000, quality: { hash: 'aaaaaaaaaaaaaaaa', score: 0.8 } });
    expect(findDuplicates([small, big]).get(small.id)).toBe(big.id);
  });

  it('dátum nélküli képeket is összehasonlít', () => {
    const a = photo({ quality: { hash: 'abcdefabcdefabcd', score: 0.4 } });
    const b = photo({ quality: { hash: 'abcdefabcdefabcd', score: 0.5 } });
    expect(findDuplicates([a, b]).get(a.id)).toBe(b.id);
  });
});

describe('applyDuplicates', () => {
  it('jelöli a duplikátumot, de a már sötétnek jelöltet meghagyja', () => {
    const a = photo({ takenAt: T, quality: { hash: 'f0f0f0f0f0f0f0f0', score: 0.9 } });
    const b = photo({ takenAt: T + 1000, quality: { hash: 'f0f0f0f0f0f0f0f0', score: 0.5 } });
    const dark = photo({ takenAt: T + 2000, excludedReason: 'dark', included: false, quality: { hash: 'f0f0f0f0f0f0f0f0', score: 0.1 } });
    expect(applyDuplicates([a, b, dark])).toBe(1);
    expect(b.excludedReason).toBe('duplicate');
    expect(b.duplicateOf).toBe(a.id);
    expect(b.included).toBe(false);
    expect(dark.excludedReason).toBe('dark');
    expect(a.excludedReason).toBeUndefined();
  });
});
