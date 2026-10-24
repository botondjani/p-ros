// Magyar nyelvű dátum- és számformázás.

const dayFmt = new Intl.DateTimeFormat('hu-HU', { month: 'long', day: 'numeric' });
const weekdayFmt = new Intl.DateTimeFormat('hu-HU', { weekday: 'long' });
const monthFmt = new Intl.DateTimeFormat('hu-HU', { month: 'long' });
const timeFmt = new Intl.DateTimeFormat('hu-HU', { hour: '2-digit', minute: '2-digit' });
const numFmt = new Intl.NumberFormat('hu-HU');

export const capitalize = (s: string) => (s ? s[0].toLocaleUpperCase('hu-HU') + s.slice(1) : s);

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** „október 30.” */
export function formatDay(t: number): string {
  return dayFmt.format(t).replace(/\s+/g, ' ');
}

/** „szombat” */
export function formatWeekday(t: number): string {
  return weekdayFmt.format(t);
}

export function formatMonth(t: number): string {
  return monthFmt.format(t);
}

export function formatTime(t: number): string {
  return timeFmt.format(t);
}

export function formatNumber(n: number): string {
  return numFmt.format(Math.round(n));
}

/**
 * Időszak tömören: „2022. október 30.”, „2022. október 28–30.”,
 * „2022. október 28. – november 2.”, „2021. december 28. – 2022. január 2.”
 */
export function formatRange(start: number, end: number): string {
  const a = new Date(start);
  const b = new Date(end);
  const ya = a.getFullYear();
  const yb = b.getFullYear();
  if (sameDay(a, b)) return `${ya}. ${formatDay(start)}`;
  if (ya === yb && a.getMonth() === b.getMonth()) return `${ya}. ${formatMonth(start)} ${a.getDate()}–${b.getDate()}.`;
  if (ya === yb) return `${ya}. ${formatDay(start)} – ${formatDay(end)}`;
  return `${ya}. ${formatDay(start)} – ${yb}. ${formatDay(end)}`;
}

export function partOfDay(t: number): string {
  const h = new Date(t).getHours();
  if (h < 4) return 'éjjel';
  if (h < 7) return 'hajnalban';
  if (h < 10) return 'reggel';
  if (h < 12) return 'délelőtt';
  if (h < 18) return 'délután';
  if (h < 22) return 'este';
  return 'éjjel';
}

/** Naptári napok száma két időpont között (mindkét végpontot beleszámolva). */
export function calendarDays(start: number, end: number): number {
  const a = new Date(start);
  const b = new Date(end);
  const da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / 86_400_000) + 1;
}

/** „1 kép”, „12 kép” – a magyarban a számnév után egyes szám áll. */
export const plural = (n: number, noun: string) => `${formatNumber(n)} ${noun}`;
