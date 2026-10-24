import { describe, expect, it } from 'vitest';
import { findTiffHeader } from '../src/pipeline/exif';

const enc = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

describe('findTiffHeader', () => {
  it('megtalálja a big-endian TIFF-fejlécet az Exif jelölő után', () => {
    const bytes = new Uint8Array([...enc('xxxx\0\0\0\x06'), ...enc('Exif\0\0MM\0*\0\0\0\x08'), 1, 2, 3]);
    expect(findTiffHeader(bytes)).toBe(14);
  });
  it('megtalálja a little-endian fejlécet', () => {
    const bytes = new Uint8Array([...enc('Exif\0\0II*\0\x08\0\0\0')]);
    expect(findTiffHeader(bytes)).toBe(6);
  });
  it('-1, ha nincs érvényes fejléc', () => {
    expect(findTiffHeader(enc('Exif\0\0nothing here'))).toBe(-1);
    expect(findTiffHeader(new Uint8Array(0))).toBe(-1);
  });
});
