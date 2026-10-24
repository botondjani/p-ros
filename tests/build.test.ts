import { describe, expect, it } from 'vitest';
import { buildProject, medoid } from '../src/analysis/build';
import type { Photo } from '../src/model/types';

const LIS = { lat: 38.7223, lng: -9.1393 };
const POR = { lat: 41.1579, lng: -8.6291 };
const t = (d: number, h: number) => new Date(2025, 4, d, h).getTime();

let n = 0;
function photo(p: Partial<Photo>): Photo {
  return {
    id: `p${n++}`,
    sourceId: 's',
    fileName: 'x.jpg',
    takenAt: null,
    timeSource: 'exif',
    width: 4000,
    height: 3000,
    quality: { sharpness: 200, brightness: 0.5, contrast: 0.2, hash: '', score: 0.5 },
    included: true,
    ...p,
  };
}

describe('buildProject', () => {
  it('fejezeteket épít, és mindenhol van kiemelt kép', () => {
    const photos = [
      photo({ takenAt: t(14, 10), gps: LIS }),
      photo({ takenAt: t(14, 11), gps: LIS }),
      photo({ takenAt: t(17, 10), gps: POR }),
      photo({ takenAt: t(17, 12), gps: POR }),
    ];
    const p = buildProject(photos);
    expect(p.chapters).toHaveLength(2);
    for (const c of p.chapters) expect(c.heroPhotoId).toBeDefined();
    expect(p.dateRange.start).toBe(t(14, 10));
  });

  it('a dátum nélküli GPS-es kép a legközelebbi fejezetbe kerül', () => {
    const lost = photo({ takenAt: null, timeSource: 'none', gps: { lat: 41.15, lng: -8.62 } });
    const p = buildProject([photo({ takenAt: t(14, 10), gps: LIS }), photo({ takenAt: t(17, 10), gps: POR }), lost]);
    const porto = p.chapters.find((c) => c.photoIds.includes(lost.id));
    expect(porto?.location?.lat).toBeCloseTo(POR.lat, 3);
    expect(p.chapters.some((c) => c.title === 'Dátum nélkül')).toBe(false);
  });

  it('a hely és dátum nélküli kép a „Dátum nélkül” fejezetbe kerül', () => {
    const lost = photo({ takenAt: null, timeSource: 'none' });
    const p = buildProject([photo({ takenAt: t(14, 10), gps: LIS }), lost]);
    const last = p.chapters[p.chapters.length - 1];
    expect(last.title).toBe('Dátum nélkül');
    expect(last.photoIds).toEqual([lost.id]);
  });

  it('ha a többségnek van EXIF-dátuma, a fájlidőt nem hisszük el', () => {
    const fileTimed = photo({ takenAt: t(30, 10), timeSource: 'file' });
    const p = buildProject([photo({ takenAt: t(14, 10), gps: LIS }), photo({ takenAt: t(14, 11), gps: LIS }), fileTimed]);
    expect(p.chapters.find((c) => c.photoIds.includes(fileTimed.id))?.title).toBe('Dátum nélkül');
  });
});

describe('medoid', () => {
  it('valódi pontot ad vissza, nem két város közötti átlagot', () => {
    const m = medoid([LIS, LIS, { lat: 38.73, lng: -9.14 }, POR])!;
    expect(m.lat).toBeLessThan(39);
  });
});
