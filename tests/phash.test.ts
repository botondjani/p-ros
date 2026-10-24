import { describe, expect, it } from 'vitest';
import { dHash, dHashFromGrid, downsampleTo9x8, hammingDistance } from '../src/analysis/phash';
import { scene } from './helpers';

describe('dHash', () => {
  it('16 hexa karakter', () => {
    expect(dHash(scene(90, 80, 1), 90, 80)).toMatch(/^[0-9a-f]{16}$/);
  });
  it('balról jobbra csökkenő fényerő → csupa 1 bit', () => {
    const grid = Array.from({ length: 72 }, (_, i) => 100 - (i % 9));
    expect(dHashFromGrid(grid)).toBe('ffffffffffffffff');
  });
  it('fényerő- és kontrasztváltozásra nem érzékeny', () => {
    const a = scene(180, 120, 4);
    const b = a.map((v) => v * 0.5 + 20);
    expect(hammingDistance(dHash(a, 180, 120), dHash(b, 180, 120))).toBeLessThanOrEqual(2);
  });
  it('enyhe zajra stabil, más képre nagyon eltér', () => {
    const a = scene(180, 120, 4);
    const noisy = a.map((v, i) => v + ((i * 7919) % 11) - 5);
    const other = scene(180, 120, 99);
    expect(hammingDistance(dHash(a, 180, 120), dHash(noisy, 180, 120))).toBeLessThanOrEqual(4);
    expect(hammingDistance(dHash(a, 180, 120), dHash(other, 180, 120))).toBeGreaterThan(12);
  });
  it('a kicsinyítés átlagol', () => {
    const g = downsampleTo9x8(new Float32Array(18 * 16).fill(7), 18, 16);
    expect(Array.from(g).every((v) => v === 7)).toBe(true);
  });
});

describe('hammingDistance', () => {
  it('bitkülönbség', () => {
    expect(hammingDistance('0000000000000000', '0000000000000000')).toBe(0);
    expect(hammingDistance('0000000000000000', '000000000000000f')).toBe(4);
    expect(hammingDistance('ffffffffffffffff', '0000000000000000')).toBe(64);
  });
  it('hiányzó vagy eltérő hosszú hash maximális távolság', () => {
    expect(hammingDistance('', 'ab')).toBe(64);
  });
});
