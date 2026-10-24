import type { Place } from '../model/types';
import type { Granularity } from './cluster';
import { calendarDays, capitalize, formatDay, formatMonth, formatRange, formatWeekday, partOfDay } from '../lib/format';

/** Algoritmikus fejezetcím: hely, ha van; különben dátum. */
export function autoChapterTitle(start: number, end: number, granularity: Granularity, place?: Place): string {
  if (granularity === 'month') {
    return `${capitalize(formatMonth(start))}${place?.name ? ` · ${place.name}` : ''}`;
  }
  if (place?.name && granularity === 'event') return place.name;
  const days = calendarDays(start, end);
  if (days === 1) return capitalize(`${formatDay(start)}, ${formatWeekday(start)}`);
  return capitalize(formatRange(start, end).replace(/^\d{4}\. /, ''));
}

/** Rövid, semleges alcím. AI nélkül szándékosan visszafogott, a user átírhatja. */
export function autoChapterSummary(start: number, end: number, photoCount: number, place?: Place): string {
  const days = calendarDays(start, end);
  const when = days === 1 ? capitalize(`${formatWeekday(start)} ${partOfDay(start)}`) : `${days} nap`;
  const where = place?.name ? `${place.name}${place.country ? `, ${place.country}` : ''}` : place?.country;
  return [when, where, `${photoCount} kép`].filter(Boolean).join(' · ');
}

/** Projektcím a helyekből: „Lisszabon, Sintra és Porto”, vagy ország, vagy év. */
export function autoProjectTitle(placeNames: string[], countries: string[], start: number, end: number): string {
  const uniq = [...new Set(placeNames)];
  const uniqC = [...new Set(countries)];
  if (uniq.length >= 1 && uniq.length <= 3) {
    return uniq.length === 1 ? uniq[0] : `${uniq.slice(0, -1).join(', ')} és ${uniq[uniq.length - 1]}`;
  }
  if (uniqC.length === 1) return uniqC[0];
  const ya = new Date(start).getFullYear();
  const yb = new Date(end).getFullYear();
  return ya === yb ? `A mi ${ya}-ünk` : `${ya}–${yb}`;
}
