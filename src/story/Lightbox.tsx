import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useStory } from './context';
import { PhotoImage } from './PhotoImage';
import { IconChevronLeft, IconChevronRight, IconX } from '../lib/icons';
import { formatDay, formatTime } from '../lib/format';

interface LightboxApi {
  open(photoIds: string[], index: number): void;
}
const LightboxContext = createContext<LightboxApi>({ open: () => {} });
export const useLightbox = () => useContext(LightboxContext);

export function LightboxProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ ids: string[]; index: number } | null>(null);
  const open = useCallback((ids: string[], index: number) => setState({ ids, index }), []);
  return (
    <LightboxContext.Provider value={{ open }}>
      {children}
      {state && <Lightbox ids={state.ids} index={state.index} onIndex={(index) => setState({ ...state, index })} onClose={() => setState(null)} />}
    </LightboxContext.Provider>
  );
}

function Lightbox({ ids, index, onIndex, onClose }: { ids: string[]; index: number; onIndex(i: number): void; onClose(): void }) {
  const { project } = useStory();
  const photo = project.photos[ids[index]];
  const touch = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const go = useCallback((d: number) => onIndex((index + d + ids.length) % ids.length), [index, ids.length, onIndex]);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prevFocus?.focus?.();
    };
  }, [go, onClose]);

  if (!photo) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Képnézegető"
      className="fixed inset-0 z-50 flex flex-col bg-[rgb(12_10_9/0.94)] text-[#f3ede4] backdrop-blur-sm"
      onClick={onClose}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current == null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-sm sm:px-6">
        <span className="tabular opacity-70">
          {index + 1} / {ids.length}
        </span>
        <button ref={closeRef} onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="Bezárás">
          <IconX width={22} height={22} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16" onClick={(e) => e.stopPropagation()}>
        <div style={{ width: `min(100%, calc((100svh - 9rem) * ${photo.width / photo.height}))` }}>
          <PhotoImage photo={photo} size="display" eager className="!bg-transparent" />
        </div>
      </div>
      <div className="px-4 pb-5 pt-3 text-center text-sm opacity-80" onClick={(e) => e.stopPropagation()}>
        {photo.caption && <p className="font-display text-base italic">{photo.caption}</p>}
        {photo.takenAt != null && (
          <p className="tabular mt-1 text-xs opacity-70">
            {formatDay(photo.takenAt)} · {formatTime(photo.takenAt)}
          </p>
        )}
      </div>
      {ids.length > 1 && (
        <>
          <button onClick={(e) => (e.stopPropagation(), go(-1))} className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full p-3 hover:bg-white/10 sm:block" aria-label="Előző">
            <IconChevronLeft width={28} height={28} />
          </button>
          <button onClick={(e) => (e.stopPropagation(), go(1))} className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full p-3 hover:bg-white/10 sm:block" aria-label="Következő">
            <IconChevronRight width={28} height={28} />
          </button>
        </>
      )}
    </div>
  );
}
