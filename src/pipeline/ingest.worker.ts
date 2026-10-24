/// <reference lib="webworker" />
import { readExif } from './exif';
import { decodeHeic, isHeic } from './heic';
import { dHash } from '../analysis/phash';
import { exposureStats, laplacianVariance, toGray } from '../analysis/quality';
import { ANALYSIS_MAX, DISPLAY_MAX, THUMB_MAX, type IngestRequest, type IngestResponse } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

function fit(w: number, h: number, max: number) {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

async function resizeToBlob(src: ImageBitmap, max: number, quality: number): Promise<Blob> {
  const { w, h } = fit(src.width, src.height, max);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  return canvas.convertToBlob({ type: 'image/jpeg', quality });
}

async function process(req: IngestRequest): Promise<IngestResponse> {
  const heic = await isHeic(req.blob, req.name);
  const exif = req.meta?.takenAt != null && req.meta?.gps ? {} : await readExif(req.blob, heic);
  const takenAtExif = req.meta?.takenAt ?? exif.takenAt;
  const gps = req.meta?.gps ?? exif.gps;

  let bitmap: ImageBitmap | undefined;
  let decodeError = 'nem dekódolható';
  try {
    bitmap = await createImageBitmap(req.blob, { imageOrientation: 'from-image' });
  } catch {
    if (heic) {
      try {
        bitmap = await decodeHeic(req.blob);
      } catch (e) {
        decodeError = `HEIC: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
  }
  if (!bitmap) {
    return {
      ok: false,
      id: req.id,
      error: 'decode',
      message: decodeError,
      meta: { takenAt: takenAtExif, gps },
    };
  }

  try {
    const width = bitmap.width;
    const height = bitmap.height;

    // Előbb egy köztes, kisebb példány: a nagy (pl. 48 MP-es) képet csak egyszer kell lekicsinyíteni.
    const target = fit(width, height, DISPLAY_MAX);
    const mid = await createImageBitmap(bitmap, { resizeWidth: target.w, resizeHeight: target.h, resizeQuality: 'high' });
    bitmap.close();

    const [display, thumb] = await Promise.all([resizeToBlob(mid, DISPLAY_MAX, 0.84), resizeToBlob(mid, THUMB_MAX, 0.8)]);

    const a = fit(mid.width, mid.height, ANALYSIS_MAX);
    const canvas = new OffscreenCanvas(a.w, a.h);
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(mid, 0, 0, a.w, a.h);
    mid.close();
    const gray = toGray(ctx.getImageData(0, 0, a.w, a.h).data, a.w, a.h);
    const { brightness, contrast } = exposureStats(gray);

    const timeSource = takenAtExif != null ? 'exif' : req.lastModified ? 'file' : 'none';
    return {
      ok: true,
      id: req.id,
      takenAt: takenAtExif ?? req.lastModified ?? null,
      timeSource,
      gps,
      width,
      height,
      sharpness: laplacianVariance(gray, a.w, a.h),
      brightness,
      contrast,
      hash: dHash(gray, a.w, a.h),
      display,
      thumb,
    };
  } catch (e) {
    return { ok: false, id: req.id, error: 'unknown', message: e instanceof Error ? e.message : String(e) };
  }
}

self.onmessage = async (ev: MessageEvent<IngestRequest>) => {
  const res = await process(ev.data);
  self.postMessage(res);
};
