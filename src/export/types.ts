import type { Project } from '../model/types';
import type { EncryptedPayload } from './crypto';

/** Az exportált oldal adatai (data.js → window.__IDOKAPSZULA__). */
export type ExportData =
  | { kind: 'plain'; project: Project }
  /**
   * Egyetlen HTML-fájl: a képek a fájlban lévő <img id="…"> elemekben vannak
   * (data: URI), a photo.src ezekre mutat (#id). Ugyanezek a képek JavaScript
   * nélkül is látszanak (pl. telefonos előnézetben).
   */
  | { kind: 'inline'; project: Project }
  /** Titkosítva: a projekt és a képek (base64) együtt, egyetlen titkos blokkban. */
  | { kind: 'encrypted'; title: string; payload: EncryptedPayload };

export interface DecryptedBundle {
  project: Project;
  images: Record<string, string>;
}

declare global {
  interface Window {
    __IDOKAPSZULA__?: ExportData;
  }
}
