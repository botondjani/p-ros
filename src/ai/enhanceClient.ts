import type { Chapter, Project } from '../model/types';
import { getImageBlob } from '../lib/images';
import { toBase64 } from '../export/crypto';
import { capitalize, formatDay, formatRange, formatWeekday } from '../lib/format';

/** Ami a szerverre megy: fejezetenként legfeljebb ennyi kép, legfeljebb ekkora hosszabbik oldallal. */
export const AI_MAX_PHOTOS = 6;
export const AI_MAX_EDGE = 768;

export interface EnhanceResult {
  title: string;
  summary: string;
  bestPhotoId: string;
}

export class EnhanceError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

const endpoint = () => import.meta.env.VITE_ENHANCE_URL || `${import.meta.env.BASE_URL}api/enhance`;

function when(c: Chapter): string {
  if (!Number.isFinite(c.dateRange.start)) return 'ismeretlen időpont';
  const same = new Date(c.dateRange.start).toDateString() === new Date(c.dateRange.end).toDateString();
  return same ? capitalize(`${formatDay(c.dateRange.start)}, ${formatWeekday(c.dateRange.start)}`) : formatRange(c.dateRange.start, c.dateRange.end);
}

/** A fejezet AI-nak küldött képei: a kiemelt, majd a legjobb pontszámú látható képek. */
export function candidatePhotos(project: Project, c: Chapter): string[] {
  const visible = c.photoIds.filter((id) => project.photos[id]?.included);
  const sorted = [...visible].sort((a, b) => project.photos[b].quality.score - project.photos[a].quality.score);
  const ordered = c.heroPhotoId && visible.includes(c.heroPhotoId) ? [c.heroPhotoId, ...sorted.filter((id) => id !== c.heroPhotoId)] : sorted;
  return ordered.slice(0, AI_MAX_PHOTOS);
}

/** Kis felbontású, metaadat nélküli JPEG (a canvas nem viszi át az EXIF-et). */
async function downscale(blob: Blob): Promise<string> {
  const bmp = await createImageBitmap(blob);
  const s = Math.min(1, AI_MAX_EDGE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * s);
  const h = Math.round(bmp.height * s);
  const canvas = new OffscreenCanvas(w, h);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const out = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.72 });
  return toBase64(new Uint8Array(await out.arrayBuffer()));
}

/** Kép nélküli állapotlekérdezés: elérhető-e és be van-e állítva az AI-végpont. */
export async function enhanceAvailability(): Promise<'ok' | 'not_configured' | 'unavailable'> {
  try {
    const res = await fetch(endpoint(), { method: 'GET' });
    if (!res.ok) return 'unavailable';
    const json = await res.json();
    return json.configured ? 'ok' : 'not_configured';
  } catch {
    return 'unavailable';
  }
}

export async function enhanceChapter(project: Project, chapter: Chapter, signal?: AbortSignal): Promise<EnhanceResult> {
  const ids = candidatePhotos(project, chapter);
  if (!ids.length) throw new EnhanceError('Nincs látható kép a fejezetben.', 'empty');
  const photos = await Promise.all(
    ids.map(async (id) => {
      const blob = await getImageBlob(project.id, id, 'display');
      if (!blob) throw new EnhanceError('Hiányzó kép.', 'missing');
      return { id, data: await downscale(blob) };
    }),
  );
  const body = {
    projectTitle: project.title,
    chapter: {
      id: chapter.id,
      when: when(chapter),
      place: [chapter.location?.name, chapter.location?.country].filter(Boolean).join(', ') || undefined,
      currentTitle: chapter.title,
      photos,
    },
    otherChapters: project.chapters
      .filter((c) => c.id !== chapter.id)
      .map((c) => ({ when: when(c), place: c.location?.name, title: c.title })),
  };

  let res: Response;
  try {
    res = await fetch(endpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new EnhanceError('Nincs kapcsolat a szerverrel.', 'network');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new EnhanceError(json.message || `Hiba (${res.status})`, json.error || String(res.status));
  return json as EnhanceResult;
}
