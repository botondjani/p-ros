import { useEffect, useState } from 'react';
import { useStore } from '../model/store';

const HINTS = ['Időbélyegeket olvasunk…', 'Helyeket keresünk a térképen…', 'Élességet mérünk…', 'Hasonló képeket párosítunk…', 'Napokra bontjuk az emlékeket…'];

export function Processing() {
  const p = useStore((s) => s.processing);
  const [hint, setHint] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setHint((h) => (h + 1) % HINTS.length), 1800);
    return () => clearInterval(t);
  }, []);

  const total = p?.total ?? 0;
  const done = p?.done ?? 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const label =
    p?.phase === 'loading' ? 'Mintaképek betöltése' : p?.phase === 'analyzing' ? 'Fejezetek összeállítása' : `${done} / ${total} kép`;
  const r = 52;
  const circ = 2 * Math.PI * r;

  return (
    <main className="grain flex min-h-svh flex-col items-center justify-center px-6 text-center" aria-live="polite">
      <svg width="140" height="140" viewBox="0 0 140 140" className="mb-8 -rotate-90" aria-hidden>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--c-line)" strokeWidth="3" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="var(--c-accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - (p?.phase === 'analyzing' ? 1 : pct / 100))}
          style={{ transition: 'stroke-dashoffset .4s ease' }}
        />
      </svg>
      <h1 className="font-display text-3xl font-[380] sm:text-4xl">{label}</h1>
      <p className="mt-3 min-h-6 text-muted">{HINTS[hint]}</p>
      <p className="mt-10 flex items-center gap-2 text-xs text-muted">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
        Minden a böngésződben történik – a képek nem kerülnek fel sehova.
      </p>
      {!!p?.failed.length && (
        <details className="mt-6 max-w-md text-left text-sm text-muted">
          <summary className="cursor-pointer">{p.failed.length} fájlt kihagytunk</summary>
          <ul className="mt-2 space-y-1">
            {p.failed.slice(0, 20).map((f, i) => (
              <li key={i}>
                <span className="font-medium text-ink">{f.name}</span> – {f.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
