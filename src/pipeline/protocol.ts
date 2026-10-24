import type { GeoPoint } from '../model/types';

export interface IngestRequest {
  id: string;
  name: string;
  blob: Blob;
  lastModified?: number;
  meta?: { takenAt?: number; gps?: GeoPoint };
}

export interface IngestSuccess {
  ok: true;
  id: string;
  takenAt: number | null;
  timeSource: 'exif' | 'file' | 'none';
  gps?: GeoPoint;
  width: number;
  height: number;
  sharpness: number;
  brightness: number;
  contrast: number;
  hash: string;
  display: Blob;
  thumb: Blob;
}

export interface IngestFailure {
  ok: false;
  id: string;
  error: 'decode' | 'unknown';
  message: string;
  /** Az EXIF-adatok akkor is visszajönnek, ha a dekódolás nem sikerült. */
  meta?: { takenAt?: number; gps?: GeoPoint };
}

export type IngestResponse = IngestSuccess | IngestFailure;

export const DISPLAY_MAX = 1600;
export const THUMB_MAX = 720;
export const ANALYSIS_MAX = 256;
