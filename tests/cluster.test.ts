import { describe, expect, it } from 'vitest';
import { clusterPhotos, type ClusterInput } from '../src/analysis/cluster';

const H = 3_600_000;
const t0 = new Date(2025, 4, 14, 9, 0).getTime();
const LIS = { lat: 38.7223, lng: -9.1393 };
const SIN = { lat: 38.7975, lng: -9.388 };
const POR = { lat: 41.1579, lng: -8.6291 };

let n = 0;
const ph = (hours: number, gps?: { lat: number; lng: number }): ClusterInput => ({ id: `p${n++}`, takenAt: t0 + hours * H, gps });

describe('clusterPhotos', () => {
  it('időrés (> 6 óra) mentén vág', () => {
    const items = [ph(0, LIS), ph(1, LIS), ph(2, LIS), ph(10, LIS), ph(11, LIS)];
    const r = clusterPhotos(items);
    expect(r.groups.map((g) => g.photoIds.length)).toEqual([3, 2]);
  });

  it('nagy elmozdulásnál (> 30 km) akkor is vág, ha kicsi az időrés', () => {
    const items = [ph(0, LIS), ph(0.5, LIS), ph(3, POR), ph(3.5, POR)];
    const r = clusterPhotos(items);
    expect(r.groups).toHaveLength(2);
    expect(r.groups[1].photoIds).toEqual([items[2].id, items[3].id]);
  });

  it('kis elmozdulás (Lisszabon → Sintra, ~23 km) egy eseményben marad', () => {
    const items = [ph(0, LIS), ph(1, LIS), ph(2, SIN), ph(3, SIN)];
    expect(clusterPhotos(items).groups).toHaveLength(1);
  });

  it('a GPS nélküli képek az eseményükbe kerülnek, és becsült helyet kapnak', () => {
    const items = [ph(0, LIS), ph(1), ph(2, LIS)];
    const r = clusterPhotos(items);
    expect(r.groups).toHaveLength(1);
    expect(r.inferredGps[items[1].id]).toBeDefined();
    expect(r.inferredGps[items[1].id].lat).toBeCloseTo(LIS.lat, 3);
  });

  it('a csak GPS nélküli képekből álló esemény az időben közeli (≤ 12 óra) helyes eseményhez olvad', () => {
    const items = [ph(0, LIS), ph(1, LIS), ph(8), ph(8.5)];
    const r = clusterPhotos(items);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].photoIds).toHaveLength(4);
  });

  it('a távoli, hely nélküli esemény „hely nélkül” marad', () => {
    const items = [ph(0, LIS), ph(1, LIS), ph(48), ph(48.5)];
    const r = clusterPhotos(items);
    expect(r.groups).toHaveLength(2);
    expect(r.groups[1].placeless).toBe(true);
    expect(r.inferredGps[items[2].id]).toBeUndefined();
  });

  it('az egyképes esemény a 24 órán belüli szomszédhoz olvad', () => {
    const items = [ph(0, LIS), ph(1, LIS), ph(9, LIS), ph(20, LIS), ph(21, LIS)];
    const r = clusterPhotos(items);
    // a 9 órás magányos kép a közelebbi (korábbi) csoporthoz kerül
    expect(r.groups.map((g) => g.photoIds.length)).toEqual([3, 2]);
  });

  it('a dátum nélküli képeket külön adja vissza', () => {
    const items = [ph(0, LIS), { id: 'x', takenAt: null, gps: LIS }];
    const r = clusterPhotos(items);
    expect(r.undated).toEqual(['x']);
    expect(r.groups.flatMap((g) => g.photoIds)).not.toContain('x');
  });

  it('sorrendtől független (időrendbe rendez)', () => {
    const items = [ph(10, LIS), ph(0, LIS), ph(11, LIS), ph(1, LIS)];
    const r = clusterPhotos(items);
    expect(r.groups[0].photoIds).toEqual([items[1].id, items[3].id]);
  });

  it('túl sok esemény esetén napokra, majd hónapokra von össze', () => {
    // egy év, havonta 3 nap, naponta két (10 órával elválasztott) kétképes blokk → 72 esemény
    const items: ClusterInput[] = [];
    for (let m = 0; m < 12; m++)
      for (let d = 1; d <= 3; d++)
        for (const h of [8, 8.5, 18, 18.5])
          items.push({ id: `y${m}-${d}-${h}`, takenAt: new Date(2024, m, d * 5, Math.floor(h), (h % 1) * 60).getTime(), gps: LIS });
    const r = clusterPhotos(items, { maxChapters: 12 });
    expect(r.granularity).toBe('month');
    expect(r.groups).toHaveLength(12);
    const r2 = clusterPhotos(items, { maxChapters: 40 });
    expect(r2.granularity).toBe('day');
    expect(r2.groups).toHaveLength(36);
  });

  it('üres bemenetre üres eredmény', () => {
    const r = clusterPhotos([]);
    expect(r.groups).toEqual([]);
    expect(r.undated).toEqual([]);
  });
});
