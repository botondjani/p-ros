import exifr from 'exifr';
import type { GeoPoint } from '../model/types';
import { isValidGps } from '../analysis/geo';

export interface ExifInfo {
  takenAt?: number;
  gps?: GeoPoint;
}

/**
 * Az EXIF dátum „falióra-idő” (helyi idő a fényképezés helyén), időzóna
 * nélkül. Úgy kezeljük, mintha a böngésző helyi idejében készült volna,
 * így a napok és napszakok a képen látható időt követik.
 */
function toLocalMs(v: unknown): number | undefined {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.getTime();
  if (typeof v === 'string') {
    const m = v.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
  }
  return undefined;
}

export async function readExif(blob: Blob): Promise<ExifInfo> {
  try {
    const data = await exifr.parse(blob, {
      pick: ['DateTimeOriginal', 'CreateDate', 'DateTimeDigitized', 'ModifyDate', 'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef'],
      gps: true,
      reviveValues: true,
    });
    if (!data) return {};
    const takenAt = toLocalMs(data.DateTimeOriginal) ?? toLocalMs(data.CreateDate) ?? toLocalMs(data.DateTimeDigitized);
    const gps = { lat: data.latitude, lng: data.longitude };
    // 1990 előtti dátum szinte mindig gyári beállítás, nem valódi
    const plausible = takenAt && takenAt > Date.UTC(1990, 0, 1) && takenAt < Date.now() + 86_400_000 * 2;
    return { takenAt: plausible ? takenAt : undefined, gps: isValidGps(gps) ? gps : undefined };
  } catch {
    return {};
  }
}
