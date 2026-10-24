import { createStore, del, get, set } from 'idb-keyval';
import type { Project } from './types';

const store = typeof indexedDB !== 'undefined' ? createStore('idokapszula', 'projects') : undefined;
const KEY = 'current';

export async function saveProject(p: Project): Promise<void> {
  if (!store) return;
  try {
    await set(KEY, p, store);
  } catch {
    /* tárhely tele / privát mód – nem kritikus */
  }
}

export async function loadProject(): Promise<Project | undefined> {
  if (!store) return undefined;
  try {
    const p = await get<Project>(KEY, store);
    return p?.version === 1 ? p : undefined;
  } catch {
    return undefined;
  }
}

export async function clearProject(): Promise<void> {
  if (!store) return;
  try {
    await del(KEY, store);
  } catch {
    /* nem kritikus */
  }
}
