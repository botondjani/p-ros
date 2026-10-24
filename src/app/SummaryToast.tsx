import { useEffect, useState } from 'react';
import { useStore } from '../model/store';
import { IconX } from '../lib/icons';

/** Feldolgozás után röviden elmondja, mi történt a képekkel, és hogy minden visszahozható. */
export function SummaryToast() {
  const project = useStore((s) => s.project);
  const processing = useStore((s) => s.processing);
  const setEditing = useStore((s) => s.setEditing);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (processing?.phase !== 'done') return;
    setOpen(true);
    const t = setTimeout(() => setOpen(false), 12000);
    return () => clearTimeout(t);
  }, [processing?.phase, processing?.startedAt]);

  if (!open || !project) return null;
  const photos = Object.values(project.photos);
  const count = (r: string) => photos.filter((p) => p.excludedReason === r).length;
  const parts = [
    count('blurry') && `${count('blurry')} életlen`,
    count('dark') && `${count('dark')} túl sötét`,
    count('duplicate') && `${count('duplicate')} ismétlődő`,
  ].filter(Boolean);
  const shown = photos.filter((p) => p.included).length;
  const failed = processing?.failed.length ?? 0;

  return (
    <div role="status" className="fixed inset-x-3 bottom-4 z-40 mx-auto max-w-lg rounded-2xl border border-line bg-paper/95 p-4 text-sm shadow-[0_20px_50px_-20px_rgb(0_0_0/0.35)] backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="font-medium">
            {photos.length} képből {shown} került a történetbe.
          </p>
          <p className="mt-1 text-muted">
            {parts.length ? `Kiszűrtük: ${parts.join(', ')}. ` : ''}
            {failed ? `${failed} fájlt nem tudtunk beolvasni. ` : ''}A többi nem veszett el: a szerkesztőben bármelyiket visszahozhatod.
          </p>
          <button
            onClick={() => {
              setEditing(true);
              setOpen(false);
            }}
            className="mt-2 font-medium text-accent underline-offset-4 hover:underline"
          >
            Szerkesztés megnyitása
          </button>
        </div>
        <button onClick={() => setOpen(false)} className="rounded-full p-1 text-muted hover:text-ink" aria-label="Bezárás">
          <IconX />
        </button>
      </div>
    </div>
  );
}
