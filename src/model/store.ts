import { create } from 'zustand';
import type { Chapter, Photo, Project, ThemeId } from './types';
import { saveProject } from './persist';

export type View = 'landing' | 'processing' | 'story';

export interface ProcessingState {
  phase: 'loading' | 'reading' | 'analyzing' | 'done';
  done: number;
  total: number;
  failed: { name: string; reason: string }[];
  startedAt: number;
}

interface State {
  view: View;
  editing: boolean;
  project?: Project;
  processing?: ProcessingState;
  savedProject?: Pick<Project, 'title' | 'subtitle' | 'id'>;
  error?: string;

  setView(v: View): void;
  setEditing(on: boolean): void;
  setProcessing(p?: ProcessingState): void;
  setError(e?: string): void;
  setSavedProject(p?: State['savedProject']): void;
  setProject(p?: Project): void;

  updateProject(patch: Partial<Pick<Project, 'title' | 'subtitle' | 'finalMessage' | 'theme'>>): void;
  updateChapter(id: string, patch: Partial<Chapter>): void;
  updatePhoto(id: string, patch: Partial<Photo>): void;
  setPhotoIncluded(photoId: string, included: boolean): void;
  setHero(chapterId: string, photoId: string): void;
  reorderChapterPhotos(chapterId: string, photoIds: string[]): void;
  moveChapter(chapterId: string, dir: -1 | 1): void;
  setTheme(theme: ThemeId): void;
  /** Visszavonás: az utolsó szerkesztés előtti állapot. */
  undo(): void;
  canUndo: boolean;
}

const history: Project[] = [];
const HISTORY_MAX = 50;

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSave(p?: Project) {
  if (!p) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveProject(p), 400);
}

export const useStore = create<State>((set, get) => {
  /** Projektmódosítás + automatikus mentés. */
  const mutate = (fn: (p: Project) => Project) => {
    const p = get().project;
    if (!p) return;
    const next = fn(p);
    if (next === p) return;
    history.push(p);
    if (history.length > HISTORY_MAX) history.shift();
    set({ project: next, canUndo: true });
    scheduleSave(next);
  };
  const mapChapter = (id: string, fn: (c: Chapter) => Chapter) =>
    mutate((p) => ({ ...p, chapters: p.chapters.map((c) => (c.id === id ? fn(c) : c)) }));

  return {
    view: 'landing',
    editing: false,

    setView: (view) => set({ view }),
    setEditing: (editing) => set({ editing }),
    setProcessing: (processing) => set({ processing }),
    setError: (error) => set({ error }),
    setSavedProject: (savedProject) => set({ savedProject }),
    setProject: (project) => {
      history.length = 0;
      set({ project, canUndo: false });
      scheduleSave(project);
    },

    canUndo: false,
    undo: () => {
      const prev = history.pop();
      if (!prev) return;
      set({ project: prev, canUndo: history.length > 0 });
      scheduleSave(prev);
    },

    updateProject: (patch) => mutate((p) => ({ ...p, ...patch })),
    updateChapter: (id, patch) => mapChapter(id, (c) => ({ ...c, ...patch })),
    updatePhoto: (id, patch) => mutate((p) => ({ ...p, photos: { ...p.photos, [id]: { ...p.photos[id], ...patch } } })),

    setPhotoIncluded: (photoId, included) =>
      mutate((p) => {
        const photo = p.photos[photoId];
        const next: Photo = included
          ? { ...photo, included: true, excludedReason: undefined }
          : { ...photo, included: false, excludedReason: 'user' };
        const chapters = p.chapters.map((c) => {
          if (!c.photoIds.includes(photoId)) return c;
          if (!included && c.heroPhotoId === photoId) {
            const fallback = c.photoIds.find((id) => id !== photoId && p.photos[id].included);
            return { ...c, heroPhotoId: fallback };
          }
          if (included && !c.heroPhotoId) return { ...c, heroPhotoId: photoId };
          return c;
        });
        return { ...p, chapters, photos: { ...p.photos, [photoId]: next } };
      }),

    setHero: (chapterId, photoId) =>
      mutate((p) => ({
        ...p,
        photos: { ...p.photos, [photoId]: { ...p.photos[photoId], included: true, excludedReason: undefined } },
        chapters: p.chapters.map((c) => (c.id === chapterId ? { ...c, heroPhotoId: photoId } : c)),
      })),

    reorderChapterPhotos: (chapterId, photoIds) => mapChapter(chapterId, (c) => ({ ...c, photoIds })),

    moveChapter: (chapterId, dir) =>
      mutate((p) => {
        const i = p.chapters.findIndex((c) => c.id === chapterId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= p.chapters.length) return p;
        const chapters = [...p.chapters];
        [chapters[i], chapters[j]] = [chapters[j], chapters[i]];
        return { ...p, chapters };
      }),

    setTheme: (theme) => mutate((p) => ({ ...p, theme })),
  };
});

// Fejlesztéshez/teszteléshez: az állapot elérhető a konzolból.
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __store: typeof useStore }).__store = useStore;
