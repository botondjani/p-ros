/**
 * Perceptuális hash (dHash, 64 bit). A képet 9×8-as szürkeárnyalatos rácsra
 * kicsinyítjük, és soronként a szomszédos pixelek világosságát hasonlítjuk
 * össze. Hasonló képek hash-e csak néhány bitben tér el.
 */

/** dHash egy 9×8-as (72 elemű) szürkeárnyalatos rácsból, 16 hexa karakter. */
export function dHashFromGrid(grid: ArrayLike<number>): string {
  if (grid.length !== 72) throw new Error('dHash: 9×8-as rács kell');
  let hex = '';
  for (let row = 0; row < 8; row++) {
    let byte = 0;
    for (let col = 0; col < 8; col++) {
      const left = grid[row * 9 + col];
      const right = grid[row * 9 + col + 1];
      byte = (byte << 1) | (left > right ? 1 : 0);
    }
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

/** Szürkeárnyalatos kép (w×h) átlagoló kicsinyítése 9×8-as rácsra. */
export function downsampleTo9x8(gray: ArrayLike<number>, w: number, h: number): Float32Array {
  const out = new Float32Array(72);
  for (let gy = 0; gy < 8; gy++) {
    const y0 = Math.floor((gy * h) / 8);
    const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * h) / 8));
    for (let gx = 0; gx < 9; gx++) {
      const x0 = Math.floor((gx * w) / 9);
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * w) / 9));
      let sum = 0;
      let n = 0;
      for (let y = y0; y < y1 && y < h; y++)
        for (let x = x0; x < x1 && x < w; x++) {
          sum += gray[y * w + x];
          n++;
        }
      out[gy * 9 + gx] = n ? sum / n : 0;
    }
  }
  return out;
}

export function dHash(gray: ArrayLike<number>, w: number, h: number): string {
  return dHashFromGrid(downsampleTo9x8(gray, w, h));
}

const POPCOUNT4 = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

/** Eltérő bitek száma két azonos hosszú hexa hash között. */
export function hammingDistance(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    d += POPCOUNT4[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  }
  return d;
}
