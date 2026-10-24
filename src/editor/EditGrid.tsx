import { useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Chapter, ExcludedReason, Photo } from '../model/types';
import { useStore } from '../model/store';
import { useStory } from '../story/context';
import { PhotoImage } from '../story/PhotoImage';
import { IconChevronDown, IconChevronUp, IconEye, IconEyeOff, IconGrip, IconStar } from '../lib/icons';

const REASON: Record<ExcludedReason, string> = {
  blurry: 'életlen',
  dark: 'túl sötét',
  duplicate: 'ismétlődő',
  notSelected: 'kimaradt',
  user: 'kivetted',
};

function Tile({ photo, hero, onToggle, onHero }: { photo: Photo; hero: boolean; onToggle(): void; onHero(): void }) {
  const updatePhoto = useStore((s) => s.updatePhoto);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });
  const [caption, setCaption] = useState(photo.caption ?? '');
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined };

  return (
    <div ref={setNodeRef} style={style} className={`group relative ${isDragging ? 'scale-105 shadow-2xl' : ''}`}>
      <div
        {...attributes}
        {...listeners}
        className={`relative aspect-square cursor-grab touch-manipulation overflow-hidden rounded-md ring-offset-2 ring-offset-bg active:cursor-grabbing ${
          hero ? 'ring-2 ring-accent' : ''
        }`}
        aria-label={`Kép: ${photo.fileName}. Húzd az átrendezéshez.`}
      >
        <PhotoImage photo={photo} size="thumb" cover className={`transition ${photo.included ? '' : 'opacity-35 grayscale'}`} />
        <span className="absolute left-1.5 top-1.5 rounded bg-black/45 p-0.5 text-white opacity-0 transition group-hover:opacity-100">
          <IconGrip width={14} height={14} />
        </span>
        {!photo.included && photo.excludedReason && (
          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[0.65rem] font-medium text-white">
            {REASON[photo.excludedReason]}
          </span>
        )}
        {hero && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-semibold text-accent-ink">kiemelt</span>}
      </div>
      <div className="absolute right-1.5 top-1.5 flex gap-1">
        <button
          onClick={onHero}
          onPointerDown={(e) => e.stopPropagation()}
          className={`rounded-full p-1.5 shadow backdrop-blur transition ${hero ? 'bg-accent text-accent-ink' : 'bg-paper/85 text-ink hover:bg-paper'}`}
          title="Legyen ez a kiemelt kép"
          aria-label="Kiemelt kép"
          aria-pressed={hero}
        >
          <IconStar width={14} height={14} fill={hero ? 'currentColor' : 'none'} />
        </button>
        <button
          onClick={onToggle}
          onPointerDown={(e) => e.stopPropagation()}
          className="rounded-full bg-paper/85 p-1.5 text-ink shadow backdrop-blur transition hover:bg-paper"
          title={photo.included ? 'Kiveszem' : 'Visszahozom'}
          aria-label={photo.included ? 'Kép kivétele' : 'Kép visszahozása'}
          aria-pressed={photo.included}
        >
          {photo.included ? <IconEye width={14} height={14} /> : <IconEyeOff width={14} height={14} />}
        </button>
      </div>
      {photo.included && (
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => caption !== (photo.caption ?? '') && updatePhoto(photo.id, { caption: caption.trim() || undefined })}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          placeholder="Képaláírás…"
          aria-label="Képaláírás"
          className="font-display mt-1.5 w-full rounded bg-transparent px-1 py-0.5 text-sm italic text-muted outline-none placeholder:text-muted/60 focus:bg-paper focus:text-ink"
        />
      )}
    </div>
  );
}

export default function EditGrid({ chapter }: { chapter: Chapter }) {
  const { project } = useStory();
  const reorder = useStore((s) => s.reorderChapterPhotos);
  const setIncluded = useStore((s) => s.setPhotoIncluded);
  const setHero = useStore((s) => s.setHero);
  const moveChapter = useStore((s) => s.moveChapter);
  const [showExcluded, setShowExcluded] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = useMemo(
    () => chapter.photoIds.filter((id) => project.photos[id] && (showExcluded || project.photos[id].included)),
    [chapter.photoIds, project.photos, showExcluded],
  );
  const shown = chapter.photoIds.filter((id) => project.photos[id]?.included).length;
  const index = project.chapters.findIndex((c) => c.id === chapter.id);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = chapter.photoIds.indexOf(String(active.id));
    const to = chapter.photoIds.indexOf(String(over.id));
    reorder(chapter.id, arrayMove(chapter.photoIds, from, to));
  };

  return (
    <div className="rounded-2xl border border-dashed border-line bg-paper/60 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted">
          <span className="font-medium text-ink">{shown}</span> / {chapter.photoIds.length} kép látszik · húzd a sorrendhez, ★ = kiemelt
        </p>
        <div className="flex items-center gap-1">
          <label className="mr-2 flex cursor-pointer items-center gap-1.5 text-muted">
            <input type="checkbox" checked={showExcluded} onChange={(e) => setShowExcluded(e.target.checked)} className="accent-[var(--c-accent)]" />
            kimaradtak is
          </label>
          <button onClick={() => moveChapter(chapter.id, -1)} disabled={index === 0} className="rounded-full p-1.5 hover:bg-ink/5 disabled:opacity-30" title="Fejezet feljebb" aria-label="Fejezet feljebb">
            <IconChevronUp />
          </button>
          <button
            onClick={() => moveChapter(chapter.id, 1)}
            disabled={index === project.chapters.length - 1}
            className="rounded-full p-1.5 hover:bg-ink/5 disabled:opacity-30"
            title="Fejezet lejjebb"
            aria-label="Fejezet lejjebb"
          >
            <IconChevronDown />
          </button>
        </div>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {ids.map((id) => (
              <Tile
                key={id}
                photo={project.photos[id]}
                hero={chapter.heroPhotoId === id}
                onToggle={() => setIncluded(id, !project.photos[id].included)}
                onHero={() => setHero(chapter.id, id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
