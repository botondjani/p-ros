import { useMemo } from 'react';
import { useStory } from './context';
import { PhotoImage } from './PhotoImage';
import { computeStats } from '../analysis/stats';
import { formatNumber } from '../lib/format';
import { EditableText } from './EditableText';
import { useStore } from '../model/store';

export function Hero() {
  const { project, editing } = useStory();
  const stats = useMemo(() => computeStats(project), [project]);
  const updateProject = useStore((s) => s.updateProject);

  // A három első fejezet kiemelt képe „szétszórt nyomatként”.
  const prints = project.chapters
    .map((c) => (c.heroPhotoId ? project.photos[c.heroPhotoId] : undefined))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .slice(0, 3);

  const facts = [
    { n: stats.photoCount, label: 'kép' },
    { n: stats.placeCount, label: stats.placeCount === 1 ? 'helyszín' : 'helyszín' },
    { n: stats.dayCount, label: 'nap' },
    ...(stats.distanceKm >= 1 ? [{ n: stats.distanceKm, label: 'km légvonalban' }] : []),
  ];

  return (
    <header className="relative flex min-h-[100svh] flex-col overflow-hidden px-5 pb-10 pt-24 sm:px-10 lg:px-16">
      <div className="relative z-10 grid flex-1 items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div className="max-w-2xl">
          <p className="eyebrow mb-6">{project.subtitle}</p>
          <h1 className="font-display text-[clamp(2.9rem,9vw,7.2rem)] font-[350] leading-[0.95] tracking-[-0.02em] text-balance">
            <EditableText
              value={project.title}
              editing={editing}
              onChange={(title) => updateProject({ title })}
              placeholder="Cím"
              label="Cím"
            />
          </h1>
          <dl className="mt-10 flex flex-wrap gap-x-8 gap-y-5 border-t border-line pt-6">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="sr-only">{f.label}</dt>
                <dd className="font-display text-3xl font-[400] numerals sm:text-4xl">{formatNumber(f.n)}</dd>
                <dd className="eyebrow mt-1 !tracking-[0.14em]">{f.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative mx-auto hidden h-[min(62vh,560px)] w-full max-w-[520px] sm:block" aria-hidden>
          {prints[1] && (
            <div className="print absolute left-[2%] top-[14%] w-[52%] p-2 pb-8" style={{ animation: 'float-a 9s ease-in-out infinite' }}>
              <PhotoImage photo={prints[1]} size="thumb" eager />
            </div>
          )}
          {prints[2] && (
            <div className="print absolute right-[0%] top-[2%] w-[46%] p-2 pb-8" style={{ animation: 'float-b 11s ease-in-out infinite' }}>
              <PhotoImage photo={prints[2]} size="thumb" eager />
            </div>
          )}
          {prints[0] && (
            <div className="print absolute bottom-[2%] left-[22%] w-[58%] p-2.5 pb-10" style={{ animation: 'float-c 10s ease-in-out infinite' }}>
              <PhotoImage photo={prints[0]} size="display" eager />
            </div>
          )}
        </div>

        {prints[0] && (
          <div className="print -mx-1 rotate-[-1.5deg] p-2 pb-7 sm:hidden" aria-hidden>
            <PhotoImage photo={prints[0]} size="display" eager />
          </div>
        )}
      </div>

      <a href="#fejezetek" className="relative z-10 mx-auto mt-10 flex flex-col items-center gap-2 text-muted hover:text-ink">
        <span className="eyebrow">Görgess</span>
        <span className="block h-10 w-px bg-current opacity-50" />
      </a>
    </header>
  );
}
