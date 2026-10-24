import type { Chapter, Project } from '../model/types';
import { getImageBlob } from '../lib/images';
import { toBase64 } from '../export/crypto';
import { capitalize, formatDay, formatRange, formatWeekday } from '../lib/format';
import { IS_ARTIFACT, useCapability, type SampleFn } from '../lib/runtime';
import { singlePrompt } from './prompt';

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
async function downscale(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const s = Math.min(1, AI_MAX_EDGE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * s);
  const h = Math.round(bmp.height * s);
  const canvas = new OffscreenCanvas(w, h);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.72 });
}

const toB64 = async (b: Blob) => toBase64(new Uint8Array(await b.arrayBuffer()));

/**
 * Kép nélküli állapotlekérdezés: elérhető-e az AI. Az Artifactban a
 * claude.ai `sample` képessége (a megnyitó saját Claude-fiókja), máshol a
 * /api/enhance végpont.
 */
export async function enhanceAvailability(): Promise<'ok' | 'not_configured' | 'unavailable'> {
  if (IS_ARTIFACT) {
    const sample = await useCapability<SampleFn>('sample');
    const limits = await sample?.limits().catch(() => null);
    return limits?.images ? 'ok' : 'unavailable';
  }
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
  const images = await Promise.all(
    ids.map(async (id) => {
      const blob = await getImageBlob(project.id, id, 'display');
      if (!blob) throw new EnhanceError('Hiányzó kép.', 'missing');
      return { id, blob: await downscale(blob) };
    }),
  );
  const meta = {
    projectTitle: project.title,
    chapter: {
      when: when(chapter),
      place: [chapter.location?.name, chapter.location?.country].filter(Boolean).join(', ') || undefined,
      currentTitle: chapter.title,
    },
    otherChapters: project.chapters
      .filter((c) => c.id !== chapter.id)
      .map((c) => ({ when: when(c), place: c.location?.name, title: c.title })),
  };

  if (IS_ARTIFACT) return enhanceViaSample(meta, images, signal);

  const body = {
    ...meta,
    chapter: { ...meta.chapter, id: chapter.id, photos: await Promise.all(images.map(async (p) => ({ id: p.id, data: await toB64(p.blob) }))) },
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

/** Artifact-mód: a claude.ai `sample` képessége, a megnyitó saját Claude-fiókjával (nincs API-kulcs, nincs saját szerver). */
async function enhanceViaSample(
  meta: { projectTitle: string; chapter: { when: string; place?: string; currentTitle?: string }; otherChapters: { when: string; place?: string; title?: string }[] },
  images: { id: string; blob: Blob }[],
  signal?: AbortSignal,
): Promise<EnhanceResult> {
  const sample = await useCapability<SampleFn>('sample');
  const limits = await sample?.limits().catch(() => null);
  if (!sample || !limits?.images) throw new EnhanceError('Ebben a nézetben nem érhető el a Claude.', 'not_configured');
  const used = images.slice(0, limits.images.maxCount);
  const ids = used.map((p) => p.id);
  let out: Partial<EnhanceResult>;
  try {
    out = await sample.json<Partial<EnhanceResult>>(singlePrompt({ ...meta, photoIds: ids }), { images: used.map((p) => p.blob), signal });
  } catch (e) {
    const code = (e as { code?: string })?.code ?? 'upstream_error';
    if (code === 'cancelled') throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
    const messages: Record<string, string> = {
      not_granted: 'A claude.ai-ban nem engedélyezted, hogy ez az oldal használja a Claude-ot.',
      sampling_disabled: 'A fiókodban nem érhető el a Claude ehhez az oldalhoz.',
      rate_limited: 'Túl sok kérés vagy elérted a használati kereted. Próbáld újra kicsit később.',
      refused: 'A Claude ezt a fejezetet nem dolgozta fel.',
      invalid_json: 'Nem értelmezhető választ kaptunk.',
    };
    const fatal = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'images_unavailable'].includes(code);
    throw new EnhanceError(messages[code] ?? 'Hiba történt a Claude-dal.', fatal ? 'not_configured' : code);
  }
  const title = String(out?.title ?? '').trim();
  const summary = String(out?.summary ?? '').trim();
  if (!title || !summary) throw new EnhanceError('Hiányos válasz.', 'invalid_json');
  return {
    title: title.slice(0, 80),
    summary: summary.slice(0, 400),
    bestPhotoId: ids.includes(String(out.bestPhotoId)) ? String(out.bestPhotoId) : ids[0],
  };
}
