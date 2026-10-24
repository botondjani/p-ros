// Központi adatmodell. Minden időbélyeg epoch milliszekundum (helyi idő
// szerint értelmezett EXIF-dátumból), minden koordináta WGS84.

export type ThemeId = 'papir' | 'ejszaka' | 'tenger' | 'barack';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Place extends GeoPoint {
  name?: string;
  country?: string;
}

export interface DateRange {
  start: number;
  end: number;
}

export interface PhotoQuality {
  /** Laplace-variancia egy 768 px-es szürkeárnyalatos másolaton. */
  sharpness: number;
  /**
   * A Laplace-variancia aránya 768 px és 384 px között. Éles képen a finom
   * részletek megmaradnak (≈0,55–1), bemozdult vagy életlen képen a finomabb
   * skálán eltűnnek (≈0,3), függetlenül a téma kontrasztjától.
   */
  blurRatio: number;
  /** Átlagos fényerő 0–1 között. */
  brightness: number;
  /** Fényerő szórása 0–1 között. */
  contrast: number;
  /** 64 bites dHash, 16 hexa karakter. */
  hash: string;
  /** Összesített pontszám 0–1 között (élesség + expozíció). */
  score: number;
}

export type ExcludedReason = 'duplicate' | 'blurry' | 'dark' | 'notSelected' | 'user';

export interface Photo {
  id: string;
  sourceId: string;
  fileName: string;
  takenAt: number | null;
  /** Honnan jön az időbélyeg: EXIF, fájl módosítási ideje, vagy nincs. */
  timeSource: 'exif' | 'file' | 'none';
  gps?: GeoPoint;
  /** Igaz, ha a hely nem a képből, hanem a szomszédos képekből lett becsülve. */
  gpsInferred?: boolean;
  width: number;
  height: number;
  quality: PhotoQuality;
  included: boolean;
  excludedReason?: ExcludedReason;
  duplicateOf?: string;
  caption?: string;
  /**
   * Statikus képforrás (demo, export). Feltöltött képeknél üres; ott a
   * kicsinyített blobok az IndexedDB-ben vannak, lásd lib/images.ts.
   */
  src?: { display: string; thumb: string };
}

export interface Chapter {
  id: string;
  title: string;
  summary: string;
  dateRange: DateRange;
  location?: Place;
  /** A fejezet összes képe, megjelenítési sorrendben (a kizártak is). */
  photoIds: string[];
  heroPhotoId?: string;
  titleSource: 'auto' | 'ai' | 'user';
  summarySource: 'auto' | 'ai' | 'user';
}

export interface Project {
  version: 1;
  id: string;
  title: string;
  subtitle: string;
  dateRange: DateRange;
  theme: ThemeId;
  chapters: Chapter[];
  photos: Record<string, Photo>;
  finalMessage: string;
  createdAt: number;
  isDemo?: boolean;
  /** Exportban: az eredeti képszám (az export csak a látható képeket tartalmazza). */
  photoTotal?: number;
}

/**
 * Egy nyers bemeneti elem, amit egy Source ad a feldolgozó láncnak.
 * A `meta` felülírja az EXIF-ből olvasott adatokat (pl. demo képeknél,
 * ahol a kicsinyített fájlból már hiányzik az EXIF).
 */
export interface RawItem {
  id: string;
  name: string;
  blob: Blob;
  lastModified?: number;
  meta?: { takenAt?: number; gps?: GeoPoint };
}

/**
 * Bemeneti forrás absztrakció. Az MVP-ben fájlok és a demo; később ide
 * köthető bármilyen külső forrás (pl. felhőtárhely, Strava) anélkül, hogy
 * a feldolgozó lánc változna.
 */
export interface Source {
  id: string;
  kind: 'files' | 'demo';
  label: string;
  count: number;
  items(): AsyncIterable<RawItem>;
}
