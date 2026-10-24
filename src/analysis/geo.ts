import type { GeoPoint } from '../model/types';

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Légvonalbeli (nagykör) távolság két pont között, km-ben. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Egymást követő pontok közötti távolságok összege, km-ben. */
export function pathLengthKm(points: GeoPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineKm(points[i - 1], points[i]);
  return total;
}

/**
 * Pontok középpontja egységvektorok átlagolásával, így a dátumválasztó
 * vonal környékén is helyes eredményt ad.
 */
export function centroid(points: GeoPoint[]): GeoPoint | undefined {
  if (points.length === 0) return undefined;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of points) {
    const lat = toRad(p.lat);
    const lng = toRad(p.lng);
    x += Math.cos(lat) * Math.cos(lng);
    y += Math.cos(lat) * Math.sin(lng);
    z += Math.sin(lat);
  }
  const n = points.length;
  x /= n;
  y /= n;
  z /= n;
  const lng = Math.atan2(y, x);
  const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
  return { lat: (lat * 180) / Math.PI, lng: (lng * 180) / Math.PI };
}

/** Érvényes, nem nulla koordináta-e (sok telefon 0,0-t ír GPS-jel nélkül). */
export function isValidGps(p: Partial<GeoPoint> | undefined | null): p is GeoPoint {
  if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number') return false;
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return false;
  if (Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) return false;
  return !(p.lat === 0 && p.lng === 0);
}
