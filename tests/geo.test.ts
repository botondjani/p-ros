import { describe, expect, it } from 'vitest';
import { centroid, haversineKm, isValidGps, pathLengthKm } from '../src/analysis/geo';

const budapest = { lat: 47.4979, lng: 19.0402 };
const vienna = { lat: 48.2082, lng: 16.3738 };
const lisbon = { lat: 38.7223, lng: -9.1393 };
const porto = { lat: 41.1579, lng: -8.6291 };

describe('haversineKm', () => {
  it('ismert várospárok távolsága', () => {
    expect(haversineKm(budapest, vienna)).toBeCloseTo(214, 0);
    expect(haversineKm(lisbon, porto)).toBeCloseTo(274, 0);
  });
  it('szimmetrikus és önmagától nulla', () => {
    expect(haversineKm(budapest, budapest)).toBe(0);
    expect(haversineKm(budapest, lisbon)).toBeCloseTo(haversineKm(lisbon, budapest), 9);
  });
  it('a dátumválasztó vonalon át is a rövidebb utat méri', () => {
    const a = { lat: 0, lng: 179.5 };
    const b = { lat: 0, lng: -179.5 };
    expect(haversineKm(a, b)).toBeCloseTo(111.2, 0);
  });
});

describe('pathLengthKm', () => {
  it('szakaszok összege', () => {
    expect(pathLengthKm([lisbon, porto, lisbon])).toBeCloseTo(2 * haversineKm(lisbon, porto), 6);
  });
  it('0 vagy 1 pontra nulla', () => {
    expect(pathLengthKm([])).toBe(0);
    expect(pathLengthKm([lisbon])).toBe(0);
  });
});

describe('centroid', () => {
  it('két pont felezőpontja közel van a középhez', () => {
    const c = centroid([lisbon, porto])!;
    expect(haversineKm(c, lisbon)).toBeCloseTo(haversineKm(c, porto), 1);
  });
  it('a dátumválasztó vonalnál nem ugrik át a Föld túloldalára', () => {
    const c = centroid([
      { lat: 10, lng: 179 },
      { lat: 10, lng: -179 },
    ])!;
    expect(Math.abs(c.lng)).toBeGreaterThan(179);
  });
  it('üres listára undefined', () => {
    expect(centroid([])).toBeUndefined();
  });
});

describe('isValidGps', () => {
  it('kiszűri a 0,0-t és az érvénytelen értékeket', () => {
    expect(isValidGps({ lat: 0, lng: 0 })).toBe(false);
    expect(isValidGps({ lat: NaN, lng: 1 })).toBe(false);
    expect(isValidGps({ lat: 91, lng: 1 })).toBe(false);
    expect(isValidGps(undefined)).toBe(false);
    expect(isValidGps(budapest)).toBe(true);
  });
});
