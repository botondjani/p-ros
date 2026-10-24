import type { Project } from '../model/types';

/**
 * A landingre beágyazott, előre kiszámolt minta (scripts/build-demo-project.cjs).
 * Az időbélyegek UTC-ben rögzített falióra-idők; itt a néző időzónájára
 * igazítjuk, hogy a képeken látható idő (pl. 17:40) mindenhol ugyanaz legyen.
 */
let cached: Promise<Project> | undefined;

const shift = (t: number) => (Number.isFinite(t) ? t + new Date(t).getTimezoneOffset() * 60_000 : t);

export function loadDemoProject(): Promise<Project> {
  cached ??= fetch(`${import.meta.env.BASE_URL}demo/project.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('A minta nem tölthető be.'))))
    .then((p: Project) => {
      for (const ph of Object.values(p.photos)) {
        if (ph.takenAt != null) ph.takenAt = shift(ph.takenAt);
        if (ph.src) ph.src = { display: import.meta.env.BASE_URL + ph.src.display, thumb: import.meta.env.BASE_URL + ph.src.thumb };
      }
      for (const c of p.chapters) c.dateRange = { start: shift(c.dateRange.start), end: shift(c.dateRange.end) };
      p.dateRange = { start: shift(p.dateRange.start), end: shift(p.dateRange.end) };
      return p;
    });
  return cached;
}
