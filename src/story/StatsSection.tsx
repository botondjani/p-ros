import { useMemo, type ReactNode } from 'react';
import { useStory } from './context';
import { computeStats } from '../analysis/stats';
import { formatDay, formatNumber, formatTime } from '../lib/format';
import { PhotoImage } from './PhotoImage';
import { useReveal } from './useReveal';

function Card({ big, unit, label, children }: { big: string; unit?: string; label: string; children?: ReactNode }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="reveal flex flex-col justify-between gap-6 border-t border-line pt-5">
      <p className="eyebrow">{label}</p>
      <div className="flex items-end justify-between gap-4">
        <p className="font-display text-[clamp(2.6rem,6vw,4.2rem)] font-[330] leading-none numerals">
          {big}
          {unit && <span className="ml-2 text-[0.42em] font-[400] text-muted">{unit}</span>}
        </p>
        {children}
      </div>
    </div>
  );
}

export function StatsSection() {
  const { project } = useStory();
  const s = useMemo(() => computeStats(project), [project]);
  const titleRef = useReveal<HTMLHeadingElement>();
  const thumb = (id?: string) =>
    id && project.photos[id] ? (
      <div className="print w-16 shrink-0 rotate-3 p-1 pb-3 sm:w-20">
        <PhotoImage photo={project.photos[id]} size="thumb" />
      </div>
    ) : null;

  const cards: ReactNode[] = [];
  if (s.distanceKm >= 1)
    cards.push(<Card key="km" big={formatNumber(s.distanceKm)} unit="km" label="Megtett út légvonalban" />);
  if (s.busiestDay)
    cards.push(
      <Card key="busy" big={formatNumber(s.busiestDay.count)} unit="kép" label={`A legtöbb kép egy nap alatt · ${formatDay(s.busiestDay.date)}`} />,
    );
  if (s.farthest && s.farthest.km >= 1)
    cards.push(<Card key="far" big={formatNumber(s.farthest.km)} unit="km" label={`Legmesszebb az indulástól · ${s.farthest.name}`} />);
  if (s.earliest)
    cards.push(
      <Card key="early" big={formatTime(s.earliest.time)} label="A legkorábbi kép">
        {thumb(s.earliest.photoId)}
      </Card>,
    );
  if (s.latest && s.latest.photoId !== s.earliest?.photoId)
    cards.push(
      <Card key="late" big={formatTime(s.latest.time)} label="A legkésőbbi kép">
        {thumb(s.latest.photoId)}
      </Card>,
    );
  if (s.countryCount > 1) cards.push(<Card key="cc" big={formatNumber(s.countryCount)} unit="ország" label="Határon túl" />);
  cards.push(<Card key="kept" big={formatNumber(s.shownCount)} unit={`/ ${formatNumber(s.photoCount)}`} label="Ennyi kép került be ebbe a történetbe" />);

  return (
    <section className="px-5 py-24 sm:px-10 lg:px-16" aria-labelledby="szamok">
      <div className="mx-auto max-w-6xl">
        <h2 ref={titleRef} id="szamok" className="reveal font-display mb-14 text-[clamp(2.2rem,5vw,3.6rem)] font-[380] italic">
          Számokban
        </h2>
        <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">{cards}</div>
      </div>
    </section>
  );
}
