import type { Photo } from '../src/model/types';

/** Determinisztikus pszeudo-véletlen (mulberry32), hogy a tesztek stabilak legyenek. */
export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** „Természetes” szürke kép: lágy színátmenetek + éles élek + finom textúra. */
export function scene(w: number, h: number, seed = 1): Float32Array {
  const r = rng(seed);
  const g = new Float32Array(w * h);
  const blocks = Array.from({ length: 12 }, () => ({ x: r() * w, y: r() * h, s: 10 + r() * w * 0.3, v: r() * 200 }));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 40 + (x / w) * 60 + (y / h) * 40;
      for (const b of blocks) if (Math.abs(x - b.x) < b.s && Math.abs(y - b.y) < b.s * 0.6) v = b.v;
      g[y * w + x] = Math.min(255, Math.max(0, v + (r() - 0.5) * 30));
    }
  return g;
}

/** Elmosás (életlenség/bemozdulás közelítése): k sugarú doboz-szűrő vízszintesen, majd függőlegesen. */
export function motionBlur(g: Float32Array, w: number, h: number, k: number): Float32Array {
  return transpose(boxH(transpose(boxH(g, w, h, k), w, h), h, w, k), h, w);
}

function transpose(g: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(g.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[x * h + y] = g[y * w + x];
  return out;
}

function boxH(g: Float32Array, w: number, h: number, k: number): Float32Array {
  const out = new Float32Array(g.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let d = -k; d <= k; d++) {
        const xx = x + d;
        if (xx >= 0 && xx < w) {
          s += g[y * w + xx];
          n++;
        }
      }
      out[y * w + x] = s / n;
    }
  return out;
}

let n = 0;
export function photo(p: Omit<Partial<Photo>, 'quality'> & { quality?: Partial<Photo['quality']> } = {}): Photo {
  const { quality, ...rest } = p;
  return {
    id: `p${n++}`,
    sourceId: 's',
    fileName: 'x.jpg',
    takenAt: null,
    timeSource: 'exif',
    width: 4000,
    height: 3000,
    included: true,
    ...rest,
    quality: { sharpness: 1000, blurRatio: 0.7, brightness: 0.5, contrast: 0.2, hash: '', score: 0.5, ...quality },
  };
}
