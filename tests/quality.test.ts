import { describe, expect, it } from 'vitest';
import { applyQuality, exposureScore, exposureStats, halve, isBlurry, isTooDark, laplacianVariance, sharpnessStats, toGray, BLUR_RATIO_LIMIT } from '../src/analysis/quality';
import { motionBlur, photo, scene } from './helpers';

const W = 192;
const H = 128;

describe('laplacianVariance', () => {
  it('egyszínű képre nulla', () => {
    expect(laplacianVariance(new Float32Array(W * H).fill(128), W, H)).toBe(0);
  });
  it('az elmosott kép kisebb varianciát ad', () => {
    const sharp = scene(W, H, 3);
    expect(laplacianVariance(motionBlur(sharp, W, H, 4), W, H)).toBeLessThan(laplacianVariance(sharp, W, H) * 0.3);
  });
});

describe('sharpnessStats / blurRatio', () => {
  it('éles képen magas, bemozdulton alacsony a skálaarány', () => {
    const sharp = scene(W * 2, H * 2, 5);
    const blurred = motionBlur(sharp, W * 2, H * 2, 5);
    const a = sharpnessStats(sharp, W * 2, H * 2);
    const b = sharpnessStats(blurred, W * 2, H * 2);
    expect(a.blurRatio).toBeGreaterThan(BLUR_RATIO_LIMIT);
    expect(b.blurRatio).toBeLessThan(BLUR_RATIO_LIMIT);
  });
  it('a skálaarány független a kontraszttól (sötétebb, de éles kép)', () => {
    const sharp = scene(W * 2, H * 2, 9);
    const dim = sharp.map((v) => v * 0.3);
    expect(sharpnessStats(dim, W * 2, H * 2).blurRatio).toBeCloseTo(sharpnessStats(sharp, W * 2, H * 2).blurRatio, 5);
  });
});

describe('halve', () => {
  it('2×2 blokkok átlaga', () => {
    const r = halve(new Float32Array([0, 2, 4, 6, 4, 6, 8, 10]), 4, 2);
    expect(r.w).toBe(2);
    expect(r.h).toBe(1);
    expect(Array.from(r.gray)).toEqual([3, 7]);
  });
});

describe('expozíció', () => {
  it('toGray a Rec.601 súlyokkal számol', () => {
    const g = toGray(new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]), 3, 1);
    expect(g[0]).toBeCloseTo(76.2, 1);
    expect(g[1]).toBeCloseTo(149.7, 1);
    expect(g[2]).toBeCloseTo(29.1, 1);
  });
  it('fényerő és kontraszt', () => {
    const s = exposureStats(new Float32Array([0, 255, 0, 255]));
    expect(s.brightness).toBeCloseTo(0.5, 5);
    expect(s.contrast).toBeCloseTo(0.5, 5);
  });
  it('a középtónus a legjobb, a szélek rosszak', () => {
    expect(exposureScore(0.48)).toBe(1);
    expect(exposureScore(0.05)).toBeLessThan(0.1);
    expect(exposureScore(0.95)).toBeLessThan(0.1);
  });
  it('túl sötét: fekete, vagy sötét és lapos; az éjszakai fényes pontokkal teli kép nem', () => {
    expect(isTooDark({ sharpness: 10, blurRatio: 0.3, brightness: 0.03, contrast: 0.02 })).toBe(true);
    expect(isTooDark({ sharpness: 10, blurRatio: 0.3, brightness: 0.1, contrast: 0.03 })).toBe(true);
    expect(isTooDark({ sharpness: 400, blurRatio: 0.65, brightness: 0.18, contrast: 0.2 })).toBe(false);
  });
});

describe('applyQuality', () => {
  it('kiszűri a bemozdult és a sötét képet, a többit pontozza', () => {
    const good = photo({ quality: { sharpness: 3000, blurRatio: 0.7 } });
    const night = photo({ quality: { sharpness: 400, blurRatio: 0.65, brightness: 0.3, contrast: 0.26 } });
    const shaky = photo({ quality: { sharpness: 1100, blurRatio: 0.3 } });
    const dark = photo({ quality: { sharpness: 12, blurRatio: 0.3, brightness: 0.06, contrast: 0.03 } });
    const all = [good, night, shaky, dark];
    applyQuality(all);
    expect(good.excludedReason).toBeUndefined();
    expect(night.excludedReason).toBeUndefined();
    expect(shaky.excludedReason).toBe('blurry');
    expect(dark.excludedReason).toBe('dark');
    expect(good.quality.score).toBeGreaterThan(night.quality.score);
    expect(good.quality.score).toBeLessThanOrEqual(1);
  });
  it('a user döntését nem írja felül', () => {
    const p = photo({ excludedReason: 'user', included: false, quality: { blurRatio: 0.2 } });
    applyQuality([p]);
    expect(p.excludedReason).toBe('user');
  });
  it('isBlurry: abszolút küszöb is számít', () => {
    expect(isBlurry({ sharpness: 5, blurRatio: 0.8 }, 8)).toBe(true);
  });
});
