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

const PICK = {
  pick: ['DateTimeOriginal', 'CreateDate', 'DateTimeDigitized', 'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef'],
  gps: true,
  reviveValues: true,
};

/** Az `Exif\0\0` jelölő utáni TIFF-fejléc helye a bájtsorban, vagy -1. */
export function findTiffHeader(bytes: Uint8Array): number {
  for (let i = 0; i < bytes.length - 10; i++) {
    if (bytes[i] !== 0x45 || bytes[i + 1] !== 0x78 || bytes[i + 2] !== 0x69 || bytes[i + 3] !== 0x66) continue; // "Exif"
    if (bytes[i + 4] !== 0 || bytes[i + 5] !== 0) continue;
    const a = bytes[i + 6];
    const b = bytes[i + 7];
    if ((a === 0x4d && b === 0x4d && bytes[i + 9] === 0x2a) || (a === 0x49 && b === 0x49 && bytes[i + 8] === 0x2a)) return i + 6;
  }
  return -1;
}

function toInfo(data: Record<string, unknown> | undefined): ExifInfo {
  if (!data) return {};
  const takenAt = toLocalMs(data.DateTimeOriginal) ?? toLocalMs(data.CreateDate) ?? toLocalMs(data.DateTimeDigitized);
  const gps = { lat: data.latitude as number, lng: data.longitude as number };
  // 1990 előtti dátum szinte mindig gyári beállítás, nem valódi
  const plausible = takenAt && takenAt > Date.UTC(1990, 0, 1) && takenAt < Date.now() + 86_400_000 * 2;
  return { takenAt: plausible ? takenAt : undefined, gps: isValidGps(gps) ? gps : undefined };
}

/**
 * EXIF olvasása. Ha az exifr nem boldogul a konténerrel (egyes HEIC-
 * elrendezéseknél előfordul), a fájlban megkeressük a nyers TIFF-blokkot,
 * és azt értelmeztetjük.
 */
export async function readExif(blob: Blob, heic = false): Promise<ExifInfo> {
  let info: ExifInfo = {};
  try {
    info = toInfo(await exifr.parse(blob, PICK));
  } catch {
    /* tartalék lent */
  }
  if (heic && !info.takenAt && !info.gps) {
    try {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const at = findTiffHeader(bytes);
      if (at >= 0) info = toInfo(await exifr.parse(bytes.slice(at, at + 256 * 1024), PICK));
    } catch {
      /* nincs használható EXIF */
    }
  }
  return info;
}
