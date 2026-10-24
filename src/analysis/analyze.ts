import type { Photo, Project } from '../model/types';
import { applyDuplicates } from './dedup';
import { applyQuality } from './quality';
import { buildProject, type BuildOptions } from './build';

/**
 * A teljes elemzés a már beolvasott képeken: minőség → duplikátumok →
 * csoportosítás → válogatás. Tiszta függvény, a fő szálon fut (olcsó).
 */
export function analyze(photos: Photo[], opts: BuildOptions = {}): Project {
  const work = photos.map((p) => ({ ...p, quality: { ...p.quality } }));
  applyQuality(work);
  applyDuplicates(work);
  return buildProject(work, opts);
}
