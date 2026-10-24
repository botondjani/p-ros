import type { Photo, RawItem, Source } from '../model/types';
import { IngestPool } from './pool';
import type { IngestResponse } from './protocol';
import { convertHeic, isHeic } from './heic';
import { putImages } from '../lib/images';

export interface IngestProgress {
  done: number;
  total: number;
  failed: { name: string; reason: string }[];
}

const MAX_BYTES = 200 * 1024 * 1024;
const ACCEPTED = /\.(jpe?g|png|webp|gif|heic|heif|avif|tiff?|bmp)$/i;

export function isAcceptedFile(f: { name: string; type: string }) {
  return f.type.startsWith('image/') || ACCEPTED.test(f.name);
}

/**
 * A források elemeit a worker-poolon átfuttatja, és `Photo` objektumokat
 * ad vissza. Az eredeti fájlok sosem hagyják el a böngészőt; a kicsinyített
 * blobok az images tárba kerülnek.
 */
export async function ingest(
  sources: Source[],
  projectId: string,
  onProgress: (p: IngestProgress) => void,
): Promise<Photo[]> {
  const total = sources.reduce((n, s) => n + s.count, 0);
  const progress: IngestProgress = { done: 0, total, failed: [] };
  const pool = new IngestPool();
  const photos: Photo[] = [];
  const tasks: Promise<void>[] = [];

  const fail = (item: RawItem, reason: string) => {
    progress.failed.push({ name: item.name, reason });
  };

  const handle = async (source: Source, item: RawItem) => {
    try {
      if (item.blob.size > MAX_BYTES) {
        fail(item, 'túl nagy fájl');
        return;
      }
      let res: IngestResponse = await pool.run({ ...item });
      if (!res.ok && res.error === 'decode' && (await isHeic(item.blob, item.name))) {
        try {
          const jpeg = await convertHeic(item.blob);
          const meta = { ...res.meta, ...item.meta };
          res = await pool.run({ ...item, blob: jpeg, meta, converted: true });
        } catch (e) {
          fail(item, 'HEIC nem olvasható');
          return;
        }
      }
      if (!res.ok) {
        fail(item, res.error === 'decode' ? 'nem kép, vagy sérült' : res.message);
        return;
      }
      await putImages(projectId, item.id, { display: res.display, thumb: res.thumb });
      photos.push({
        id: item.id,
        sourceId: source.id,
        fileName: item.name,
        takenAt: res.takenAt,
        timeSource: res.timeSource,
        gps: res.gps,
        width: res.width,
        height: res.height,
        quality: { sharpness: res.sharpness, brightness: res.brightness, contrast: res.contrast, hash: res.hash, score: 0 },
        included: true,
      });
    } finally {
      progress.done++;
      onProgress({ ...progress, failed: [...progress.failed] });
    }
  };

  try {
    for (const source of sources) {
      for await (const item of source.items()) tasks.push(handle(source, item));
    }
    await Promise.all(tasks);
  } finally {
    pool.terminate();
  }
  return photos;
}
