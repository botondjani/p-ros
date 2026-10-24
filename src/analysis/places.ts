import type { GeoPoint } from '../model/types';
import { haversineKm } from './geo';

/**
 * Offline helynév-keresés egy beépített városlistából (GeoNames, 15 000
 * főnél nagyobb települések). Semmilyen koordináta nem megy ki a hálózatra.
 */
export interface PlaceIndex {
  names: string[];
  countries: string[];
  lat: Float32Array;
  lng: Float32Array;
}

export interface PlaceMatch {
  name?: string;
  country?: string;
  distanceKm: number;
}

interface RawPlaces {
  n: string[];
  c: number[];
  cl: string[];
  p: number[];
}

export function parsePlaces(raw: RawPlaces): PlaceIndex {
  const count = raw.n.length;
  const lat = new Float32Array(count);
  const lng = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    lat[i] = raw.p[i * 2] / 1000;
    lng[i] = raw.p[i * 2 + 1] / 1000;
  }
  return { names: raw.n, countries: raw.c.map((i) => raw.cl[i]), lat, lng };
}

let regionNames: Intl.DisplayNames | undefined;
export function countryName(code: string): string {
  try {
    regionNames ??= new Intl.DisplayNames(['hu'], { type: 'region' });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** A legközelebbi város neve; 40 km-en túl csak az ország, 150 km-en túl semmi. */
export function nearestPlace(index: PlaceIndex, p: GeoPoint): PlaceMatch {
  let best = -1;
  let bestApprox = Infinity;
  const cosLat = Math.cos((p.lat * Math.PI) / 180);
  // Gyors előszűrés síkbeli közelítéssel, pontos távolság csak a nyertesre.
  for (let i = 0; i < index.names.length; i++) {
    const dLat = index.lat[i] - p.lat;
    let dLng = Math.abs(index.lng[i] - p.lng);
    if (dLng > 180) dLng = 360 - dLng;
    const d = dLat * dLat + dLng * cosLat * (dLng * cosLat);
    if (d < bestApprox) {
      bestApprox = d;
      best = i;
    }
  }
  if (best < 0) return { distanceKm: Infinity };
  const distanceKm = haversineKm(p, { lat: index.lat[best], lng: index.lng[best] });
  const country = countryName(index.countries[best]);
  if (distanceKm <= 40) return { name: index.names[best], country, distanceKm };
  if (distanceKm <= 150) return { country, distanceKm };
  return { distanceKm };
}

let cached: Promise<PlaceIndex | null> | undefined;

/** Lustán betölti a városlistát; hiba esetén null (a címek dátum alapúak lesznek). */
export function loadPlaces(url = `${import.meta.env?.BASE_URL ?? '/'}places.json`): Promise<PlaceIndex | null> {
  cached ??= fetch(url)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((raw: RawPlaces) => parsePlaces(raw))
    .catch(() => null);
  return cached;
}
