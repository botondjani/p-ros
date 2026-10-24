import { createContext, useContext } from 'react';
import type { Project } from '../model/types';

/**
 * A történet-nézet csak ebből a kontextusból olvas, így ugyanazok a
 * komponensek futnak az alkalmazásban (szerkeszthetően) és az exportált,
 * önálló oldalon (csak olvashatóan).
 */
export interface StoryContextValue {
  project: Project;
  /** Az images tár kulcsa; exportban nem használt (ott photo.src van). */
  projectId: string;
  editing: boolean;
  /** Önálló, exportált oldalon fut-e. */
  standalone: boolean;
}

export const StoryContext = createContext<StoryContextValue | null>(null);

export function useStory(): StoryContextValue {
  const ctx = useContext(StoryContext);
  if (!ctx) throw new Error('StoryContext hiányzik');
  return ctx;
}
