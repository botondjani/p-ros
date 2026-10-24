import type { Project } from '../model/types';
import type { EncryptedPayload } from './crypto';

/** Az exportált oldal adatai (data.js → window.__IDOKAPSZULA__). */
export type ExportData =
  | { kind: 'plain'; project: Project }
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
