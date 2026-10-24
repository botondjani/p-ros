import { forwardRef, lazy, Suspense } from 'react';
import type { Chapter } from '../model/types';
import { useStory } from './context';
import { PhotoImage } from './PhotoImage';
import { useLightbox } from './Lightbox';
import { useReveal } from './useReveal';
import { EditableText } from './EditableText';
import { useStore } from '../model/store';
import { capitalize, formatDay, formatRange, formatWeekday } from '../lib/format';
import { IconPin } from '../lib/icons';

const EditGrid = lazy(() => import('../editor/EditGrid'));

interface Props {
  chapter: Chapter;
  index: number;
}

function chapterDate(c: Chapter) {
  if (!Number.isFinite(c.dateRange.start)) return 'Időpont nélkül';
  const a = new Date(c.dateRange.start);
  const b = new Date(c.dateRange.end);
  if (a.toDateString() === b.toDateString()) return capitalize(`${formatDay(c.dateRange.start)}, ${formatWeekday(c.dateRange.start)}`);
  return formatRange(c.dateRange.start, c.dateRange.end);
}

export const ChapterSection = forwardRef<HTMLElement, Props>(function ChapterSection({ chapter, index }, ref) {
  const { project, editing } = useStory();
  const lightbox = useLightbox();
  const updateChapter = useStore((s) => s.updateChapter);
  const headRef = useReveal<HTMLDivElement>();
  const gridRef = useReveal<HTMLDivElement>();

  const shown = chapter.photoIds.filter((id) => project.photos[id]?.included);
  const heroId = chapter.heroPhotoId && shown.includes(chapter.heroPhotoId) ? chapter.heroPhotoId : shown[0];
  const rest = shown.filter((id) => id !== heroId);
  const lightboxIds = heroId ? [heroId, ...rest] : rest;
  const hero = heroId ? project.photos[heroId] : undefined;
  const place = chapter.location?.name ?? chapter.location?.country;

  return (
    <section ref={ref} data-chapter-id={chapter.id} className="scroll-mt-24 py-16 sm:py-24" aria-labelledby={`ch-${chapter.id}`}>
      <div ref={headRef} className="reveal mb-8">
        <p className="eyebrow flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-display text-base font-[500] normal-case tracking-normal text-accent numerals">{String(index + 1).padStart(2, '0')}</span>
          <span>{chapterDate(chapter)}</span>
          {place && (
            <span className="inline-flex items-center gap-1">
              <IconPin width={12} height={12} />
              {place}
            </span>
          )}
        </p>
        <h2 id={`ch-${chapter.id}`} className="font-display mt-3 text-[clamp(2.2rem,5vw,3.6rem)] font-[380] leading-[1.02] tracking-[-0.015em] text-balance">
          <EditableText
            value={chapter.title}
            editing={editing}
            label="Fejezetcím"
            onChange={(title) => updateChapter(chapter.id, { title, titleSource: 'user' })}
          />
        </h2>
        <div className="font-display mt-3 max-w-xl text-lg italic leading-relaxed text-muted">
          <EditableText
            value={chapter.summary}
            editing={editing}
            multiline
            label="Fejezet szövege"
            placeholder="Pár szó erről a napról…"
            onChange={(summary) => updateChapter(chapter.id, { summary, summarySource: 'user' })}
          />
        </div>
      </div>

      {editing ? (
        <Suspense fallback={<div className="skeleton h-64 rounded-lg" />}>
          <EditGrid chapter={chapter} />
        </Suspense>
      ) : (
        <div ref={gridRef} className="reveal">
          {hero && (
            <figure className="mb-3 sm:mb-4">
              <button className="block w-full cursor-zoom-in" onClick={() => lightbox.open(lightboxIds, 0)} aria-label="Kép nagyítása">
                <PhotoImage photo={hero} className="rounded-[3px]" />
              </button>
              {hero.caption && <figcaption className="font-display mt-2 text-sm italic text-muted">{hero.caption}</figcaption>}
            </figure>
          )}
          {rest.length > 0 && (
            <div className="columns-2 gap-3 sm:gap-4 [&>*]:mb-3 sm:[&>*]:mb-4">
              {rest.map((id, i) => {
                const p = project.photos[id];
                return (
                  <figure key={id} className="break-inside-avoid">
                    <button className="group block w-full cursor-zoom-in overflow-hidden rounded-[3px]" onClick={() => lightbox.open(lightboxIds, i + 1)} aria-label="Kép nagyítása">
                      <PhotoImage photo={p} size="thumb" className="transition-transform duration-700 ease-out-soft group-hover:scale-[1.03]" />
                    </button>
                    {p.caption && <figcaption className="font-display mt-1.5 text-sm italic text-muted">{p.caption}</figcaption>}
                  </figure>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
});
