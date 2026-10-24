import { useMemo } from 'react';
import type { Chapter } from '../model/types';

/**
 * Térképcsempék nélküli útvonalrajz. Ez látszik, amíg a térkép betölt, és
 * ez marad, ha nincs hálózat vagy WebGL – így az élmény offline is teljes.
 */
export function RouteSketch({ chapters, activeId }: { chapters: Chapter[]; activeId?: string }) {
  const pts = useMemo(() => {
    const located = chapters.map((c, i) => ({ c, i })).filter(({ c }) => c.location);
    if (!located.length) return [];
    const lats = located.map(({ c }) => c.location!.lat);
    const lngs = located.map(({ c }) => c.location!.lng);
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const k = Math.cos((midLat * Math.PI) / 180);
    const xs = lngs.map((l) => l * k);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...lats);
    const maxY = Math.max(...lats);
    const span = Math.max(maxX - minX, maxY - minY, 1e-3);
    // 100×100-as nézetbe; vízszintesen balra tolva, hogy a feliratok jobbra elférjenek
    return located.map(({ c, i }, j) => ({
      id: c.id,
      n: i + 1,
      name: c.location!.name ?? c.title,
      x: 42 + ((xs[j] - (minX + maxX) / 2) / span) * 60,
      y: 50 + (((minY + maxY) / 2 - lats[j]) / span) * 70,
    }));
  }, [chapters]);

  const found = pts.findIndex((p) => p.id === activeId);
  // nincs aktív fejezet: áttekintés, minden pont egyformán, megtett út nélkül
  const activeIdx = found < 0 ? -1 : found;
  // Felirat-ütközés: előbb az aktív, aztán a többi, és csak ha nincs túl közel egy már feliratozotthoz.
  const labeled = new Set<number>();
  for (const i of [...(activeIdx >= 0 ? [activeIdx] : []), ...pts.map((_, i) => i).filter((i) => i !== activeIdx)]) {
    const p = pts[i];
    if (p && [...labeled].every((j) => Math.hypot(pts[j].x - p.x, pts[j].y - p.y) > 9)) labeled.add(i);
  }
  const line = (arr: typeof pts) => arr.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="h-full w-full" role="img" aria-label="Az út vázlata">
      <defs>
        <pattern id="sketch-grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M10 0H0V10" fill="none" stroke="var(--c-line)" strokeWidth="0.15" />
        </pattern>
      </defs>
      <rect x="-50" y="-50" width="200" height="200" fill="url(#sketch-grid)" />
      <path d={line(pts)} fill="none" stroke="var(--c-muted)" strokeOpacity="0.5" strokeWidth="0.5" strokeDasharray="1.2 1.4" strokeLinecap="round" />
      <path d={line(pts.slice(0, Math.max(0, activeIdx + 1)))} fill="none" stroke="var(--c-accent)" strokeWidth="0.7" strokeLinecap="round" />
      {pts.map((p, i) => {
        const active = i === activeIdx;
        return (
          <g key={p.id} style={{ transition: 'opacity .5s' }} opacity={activeIdx < 0 || i <= activeIdx ? 1 : 0.55}>
            <circle cx={p.x} cy={p.y} r={active ? 2.6 : 1.6} fill={active ? 'var(--c-accent)' : 'var(--c-paper)'} stroke="var(--c-accent)" strokeWidth="0.5" style={{ transition: 'r .5s' }} />
            {labeled.has(i) && <text x={p.x + 3.2} y={p.y + 1.1} fontSize="3" fill="var(--c-ink)" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
              {p.name}
            </text>}
          </g>
        );
      })}
    </svg>
  );
}
