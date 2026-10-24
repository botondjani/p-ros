import type { Chapter, GeoPoint, Photo, Place, Project, ThemeId } from '../model/types';
import { clusterPhotos, type ClusterOptions } from './cluster';
import { haversineKm } from './geo';
import { autoChapterSummary, autoChapterTitle, autoProjectTitle } from './naming';
import { nearestPlace, type PlaceIndex } from './places';
import { pickHero, selectBest } from './select';
import { uid } from '../lib/id';
import { formatRange } from '../lib/format';

export interface BuildOptions {
  places?: PlaceIndex | null;
  /** Saját helynevek (pl. látnivalók), amelyek 3 km-en belül felülírják a városnevet. */
  landmarks?: Place[];
  cluster?: Partial<ClusterOptions>;
  theme?: ThemeId;
  isDemo?: boolean;
  title?: string;
  finalMessage?: string;
}

/**
 * A fejezet „súlypontja” medoidként: az a valódi GPS-pont, amelynek a
 * többitől mért távolságösszege a legkisebb. Átlaggal ellentétben nem eshet
 * két város közé a tengerbe.
 */
export function medoid(points: GeoPoint[]): GeoPoint | undefined {
  if (points.length <= 2) return points[0];
  const sample = points.length > 120 ? points.filter((_, i) => i % Math.ceil(points.length / 120) === 0) : points;
  let best = sample[0];
  let bestSum = Infinity;
  for (const a of sample) {
    let sum = 0;
    for (const b of sample) sum += haversineKm(a, b);
    if (sum < bestSum) {
      bestSum = sum;
      best = a;
    }
  }
  return best;
}

/** Kiválasztás alkalmazása egy fejezet képeire: included / notSelected. */
export function applySelection(chapterPhotos: Photo[]): { heroPhotoId?: string } {
  const selected = new Set(selectBest(chapterPhotos));
  for (const p of chapterPhotos) {
    if (selected.has(p.id)) {
      p.included = true;
      if (p.excludedReason === 'notSelected') p.excludedReason = undefined;
    } else {
      p.included = false;
      p.excludedReason ??= 'notSelected';
    }
  }
  return { heroPhotoId: pickHero(chapterPhotos.filter((p) => p.included)) };
}

export function buildProject(input: Photo[], opts: BuildOptions = {}): Project {
  const photos: Record<string, Photo> = {};
  for (const p of input) photos[p.id] = { ...p };

  const result = clusterPhotos(
    input.map((p) => ({ id: p.id, takenAt: p.takenAt, gps: p.gps })),
    opts.cluster,
  );

  for (const [id, gps] of Object.entries(result.inferredGps)) {
    photos[id].gps = gps;
    photos[id].gpsInferred = true;
  }

  const chapters: Chapter[] = [];
  const titles = new Map<string, number>();

  for (const g of result.groups) {
    const groupPhotos = g.photoIds.map((id) => photos[id]);
    const realPoints = groupPhotos.filter((p) => p.gps && !p.gpsInferred).map((p) => p.gps!);
    const center = medoid(realPoints);
    let location: Place | undefined;
    if (center) {
      const match = opts.places ? nearestPlace(opts.places, center) : undefined;
      const landmark = opts.landmarks?.find((l) => haversineKm(l, center) <= 3);
      location = { ...center, name: landmark?.name ?? match?.name, country: match?.country };
    }
    let title = autoChapterTitle(g.start, g.end, result.granularity, location);
    const seen = titles.get(title) ?? 0;
    titles.set(title, seen + 1);
    if (seen > 0) title = `${title}, újra`;

    const { heroPhotoId } = applySelection(groupPhotos);
    chapters.push({
      id: uid('c_'),
      title,
      summary: autoChapterSummary(g.start, g.end, groupPhotos.length, location),
      dateRange: { start: g.start, end: g.end },
      location,
      photoIds: g.photoIds,
      heroPhotoId,
      titleSource: 'auto',
      summarySource: 'auto',
    });
  }

  if (result.undated.length) {
    const groupPhotos = result.undated.map((id) => photos[id]);
    const { heroPhotoId } = applySelection(groupPhotos);
    chapters.push({
      id: uid('c_'),
      title: 'Dátum nélkül',
      summary: `${groupPhotos.length} kép, amelyeknek nem tudjuk az idejét`,
      dateRange: { start: NaN, end: NaN },
      photoIds: result.undated,
      heroPhotoId,
      titleSource: 'auto',
      summarySource: 'auto',
    });
  }

  const dated = chapters.filter((c) => Number.isFinite(c.dateRange.start));
  const start = dated.length ? Math.min(...dated.map((c) => c.dateRange.start)) : Date.now();
  const end = dated.length ? Math.max(...dated.map((c) => c.dateRange.end)) : Date.now();

  const placeNames = chapters.map((c) => c.location?.name).filter((x): x is string => !!x);
  const countries = chapters.map((c) => c.location?.country).filter((x): x is string => !!x);

  return {
    version: 1,
    id: uid('p_'),
    title: opts.title ?? autoProjectTitle(placeNames, countries, start, end),
    subtitle: formatRange(start, end),
    dateRange: { start, end },
    theme: opts.theme ?? 'papir',
    chapters,
    photos,
    finalMessage: opts.finalMessage ?? '',
    createdAt: Date.now(),
    isDemo: opts.isDemo,
  };
}
