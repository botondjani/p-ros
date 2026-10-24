import type { Chapter, Photo, Project } from '../model/types';
import { haversineKm, pathLengthKm } from './geo';

export interface ProjectStats {
  photoCount: number;
  shownCount: number;
  placeCount: number;
  dayCount: number;
  distanceKm: number;
  busiestDay?: { date: number; count: number };
  farthest?: { name: string; km: number };
  earliest?: { photoId: string; time: number };
  latest?: { photoId: string; time: number };
  longestChapter?: { title: string; days: number };
  countryCount: number;
}

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
/** A nap hány perce telt el – az éjfél utáni képek a „késői” végére kerülnek (4 óráig). */
const minuteOfDay = (t: number) => {
  const d = new Date(t);
  const m = d.getHours() * 60 + d.getMinutes();
  return m < 240 ? m + 1440 : m;
};

const chapterName = (c: Chapter) => c.location?.name ?? c.title;

export function computeStats(project: Project): ProjectStats {
  const all: Photo[] = Object.values(project.photos);
  const live = all.filter((p) => p.excludedReason !== 'duplicate');
  const dated = live.filter((p) => p.takenAt != null);

  const days = new Map<string, { date: number; count: number }>();
  for (const p of dated) {
    const k = dayKey(p.takenAt!);
    const e = days.get(k) ?? { date: p.takenAt!, count: 0 };
    e.count++;
    days.set(k, e);
  }
  const busiestDay = [...days.values()].sort((a, b) => b.count - a.count)[0];

  const located = project.chapters.filter((c) => c.location);
  const route = [...located]
    .filter((c) => Number.isFinite(c.dateRange.start))
    .sort((a, b) => a.dateRange.start - b.dateRange.start)
    .map((c) => c.location!);
  // Útvonal: fejezetek helyei időrendben; oda-vissza a kiindulóponthoz nem számolunk.
  const distanceKm = pathLengthKm(route);

  let farthest: ProjectStats['farthest'];
  if (route.length > 1) {
    const origin = route[0];
    for (const c of located) {
      const km = haversineKm(origin, c.location!);
      if (!farthest || km > farthest.km) farthest = { name: chapterName(c), km };
    }
  }

  let earliest: ProjectStats['earliest'];
  let latest: ProjectStats['latest'];
  for (const p of dated.filter((p) => p.included)) {
    const m = minuteOfDay(p.takenAt!);
    if (!earliest || m < minuteOfDay(earliest.time)) earliest = { photoId: p.id, time: p.takenAt! };
    if (!latest || m > minuteOfDay(latest.time)) latest = { photoId: p.id, time: p.takenAt! };
  }

  let longestChapter: ProjectStats['longestChapter'];
  for (const c of project.chapters) {
    if (!Number.isFinite(c.dateRange.start)) continue;
    const d = Math.max(1, Math.round((c.dateRange.end - c.dateRange.start) / 86_400_000) + 1);
    if (!longestChapter || d > longestChapter.days) longestChapter = { title: c.title, days: d };
  }

  const placeNames = new Set(located.map((c) => c.location!.name ?? `${c.location!.lat.toFixed(1)},${c.location!.lng.toFixed(1)}`));
  const countries = new Set(located.map((c) => c.location!.country).filter(Boolean));

  return {
    photoCount: all.length,
    shownCount: all.filter((p) => p.included).length,
    placeCount: placeNames.size,
    dayCount: days.size,
    distanceKm,
    busiestDay,
    farthest,
    earliest,
    latest,
    longestChapter,
    countryCount: countries.size,
  };
}
