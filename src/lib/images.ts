import { createStore, del, get, keys, set } from 'idb-keyval';
import { useEffect, useState } from 'react';
import type { Photo } from '../model/types';

/**
 * A kicsinyített képek tára. Memóriában (Blob + object URL) és IndexedDB-ben
 * tartjuk őket, hogy oldalfrissítés után is megmaradjanak. Az eredeti
 * fájlokat sehol nem tároljuk.
 */
export type ImageSize = 'display' | 'thumb';

const store = typeof indexedDB !== 'undefined' ? createStore('idokapszula-images', 'blobs') : undefined;
const blobs = new Map<string, Blob>();
const urls = new Map<string, string>();
const key = (projectId: string, photoId: string, size: ImageSize) => `${projectId}:${photoId}:${size === 'display' ? 'd' : 't'}`;

export async function putImages(projectId: string, photoId: string, imgs: { display: Blob; thumb: Blob }) {
  const kd = key(projectId, photoId, 'display');
  const kt = key(projectId, photoId, 'thumb');
  blobs.set(kd, imgs.display);
  blobs.set(kt, imgs.thumb);
  if (!store) return;
  try {
    await Promise.all([set(kd, imgs.display, store), set(kt, imgs.thumb, store)]);
  } catch {
    // Tele a tárhely, vagy privát mód: a munkamenet így is működik, csak nem marad meg frissítés után.
  }
}

export async function getImageBlob(projectId: string, photoId: string, size: ImageSize): Promise<Blob | undefined> {
  const k = key(projectId, photoId, size);
  const mem = blobs.get(k);
  if (mem) return mem;
  if (!store) return undefined;
  try {
    const b = await get<Blob>(k, store);
    if (b) blobs.set(k, b);
    return b;
  } catch {
    return undefined;
  }
}

export async function getImageUrl(projectId: string, photo: Photo, size: ImageSize): Promise<string | undefined> {
  if (photo.src) return photo.src[size];
  const k = key(projectId, photo.id, size);
  const cached = urls.get(k);
  if (cached) return cached;
  const b = await getImageBlob(projectId, photo.id, size);
  if (!b) return undefined;
  const u = URL.createObjectURL(b);
  urls.set(k, u);
  return u;
}

/** Szinkron lekérdezés, ha már van URL (villanásmentes első renderhez). */
export function peekImageUrl(projectId: string, photo: Photo, size: ImageSize): string | undefined {
  return photo.src ? photo.src[size] : urls.get(key(projectId, photo.id, size));
}

export function usePhotoUrl(projectId: string | undefined, photo: Photo | undefined, size: ImageSize): string | undefined {
  const initial = projectId && photo ? peekImageUrl(projectId, photo, size) : undefined;
  const [url, setUrl] = useState(initial);
  useEffect(() => {
    if (!projectId || !photo) return;
    let alive = true;
    const now = peekImageUrl(projectId, photo, size);
    if (now) setUrl(now);
    else getImageUrl(projectId, photo, size).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [projectId, photo?.id, photo?.src, size]);
  return url;
}

export async function deleteProjectImages(projectId: string) {
  for (const [k, u] of urls) if (k.startsWith(`${projectId}:`)) {
    URL.revokeObjectURL(u);
    urls.delete(k);
  }
  for (const k of [...blobs.keys()]) if (k.startsWith(`${projectId}:`)) blobs.delete(k);
  if (!store) return;
  try {
    const all = await keys(store);
    await Promise.all(all.filter((k) => String(k).startsWith(`${projectId}:`)).map((k) => del(k, store)));
  } catch {
    /* nem kritikus */
  }
}
