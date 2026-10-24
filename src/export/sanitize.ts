import type { Photo, Project } from '../model/types';

export interface ExportPhoto {
  photo: Photo;
  display: string;
  thumb: string;
}

/**
 * Exportra kész projektmásolat: csak a látható képek, fájlnevek és
 * képenkénti pontos GPS-koordináták nélkül (a fejezetek helye marad), a
 * képek relatív útvonalakkal.
 */
export function sanitizeForExport(project: Project): { project: Project; photos: ExportPhoto[] } {
  const photos: Record<string, Photo> = {};
  const list: ExportPhoto[] = [];
  let n = 0;
  const chapters = project.chapters
    .map((c) => {
      const ids = c.photoIds.filter((id) => project.photos[id]?.included);
      for (const id of ids) {
        const src = project.photos[id];
        n++;
        const base = `img/${String(n).padStart(3, '0')}`;
        const clean: Photo = {
          id: src.id,
          sourceId: 'export',
          fileName: '',
          takenAt: src.takenAt,
          timeSource: src.timeSource,
          width: src.width,
          height: src.height,
          quality: { sharpness: 0, blurRatio: 0, brightness: 0, contrast: 0, hash: '', score: src.quality.score },
          included: true,
          caption: src.caption,
          src: { display: `${base}.jpg`, thumb: `${base}_t.jpg` },
        };
        photos[id] = clean;
        list.push({ photo: src, display: clean.src!.display, thumb: clean.src!.thumb });
      }
      return { ...c, photoIds: ids, heroPhotoId: c.heroPhotoId && ids.includes(c.heroPhotoId) ? c.heroPhotoId : ids[0] };
    })
    .filter((c) => c.photoIds.length > 0);

  return {
    project: { ...project, chapters, photos, id: 'export', photoTotal: project.photoTotal ?? Object.keys(project.photos).length },
    photos: list,
  };
}
