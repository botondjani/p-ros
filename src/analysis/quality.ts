import type { Photo } from '../model/types';

/** Szürkeárnyalatos konverzió RGBA pixelekből (Rec. 601 luma, 0–255). */
export function toGray(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Float32Array {
  const gray = new Float32Array(w * h);
  for (let i = 0, j = 0; i < gray.length; i++, j += 4) {
    gray[i] = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
  }
  return gray;
}

/**
 * Élesség: a 4-szomszédos Laplace-operátor válaszának varianciája. Életlen
 * vagy bemozdult képen kevés az éles átmenet, így alacsony a variancia.
 */
export function laplacianVariance(gray: ArrayLike<number>, w: number, h: number): number {
  if (w < 3 || h < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = gray[i - w] + gray[i + w] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** Felére kicsinyítés 2×2-es átlagolással. */
export function halve(gray: ArrayLike<number>, w: number, h: number): { gray: Float32Array; w: number; h: number } {
  const hw = w >> 1;
  const hh = h >> 1;
  const out = new Float32Array(hw * hh);
  for (let y = 0; y < hh; y++)
    for (let x = 0; x < hw; x++) {
      const i = 2 * y * w + 2 * x;
      out[y * hw + x] = (gray[i] + gray[i + 1] + gray[i + w] + gray[i + w + 1]) / 4;
    }
  return { gray: out, w: hw, h: hh };
}

/** Élesség és skálaarány egy menetben (lásd PhotoQuality.blurRatio). */
export function sharpnessStats(gray: ArrayLike<number>, w: number, h: number): { sharpness: number; blurRatio: number } {
  const sharpness = laplacianVariance(gray, w, h);
  const half = halve(gray, w, h);
  const coarse = laplacianVariance(half.gray, half.w, half.h);
  return { sharpness, blurRatio: coarse > 0 ? sharpness / coarse : 0 };
}

/** Átlagos fényerő (0–1) és kontraszt (szórás, 0–1). */
export function exposureStats(gray: ArrayLike<number>): { brightness: number; contrast: number } {
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < gray.length; i++) {
    sum += gray[i];
    sumSq += gray[i] * gray[i];
  }
  const mean = sum / gray.length;
  const variance = Math.max(0, sumSq / gray.length - mean * mean);
  return { brightness: mean / 255, contrast: Math.sqrt(variance) / 255 };
}

export interface RawQuality {
  sharpness: number;
  blurRatio: number;
  brightness: number;
  contrast: number;
}

/** Túl sötét: szinte fekete, vagy sötét és lapos (zsebben elsült kép). Az éjszakai, fényes pontokkal teli kép marad. */
export function isTooDark(q: RawQuality): boolean {
  return q.brightness < 0.05 || (q.brightness < 0.13 && q.contrast < 0.06);
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const BLUR_RATIO_LIMIT = 0.42;

/**
 * Az abszolút élesség alsó határa: a sorozat mediánjának töredéke. A
 * relatív küszöb miatt egy eleve lágy (pl. ködös) sorozatból nem dobunk ki
 * mindent.
 */
export function blurThreshold(sharpnessValues: number[]): number {
  return Math.max(8, median(sharpnessValues) * 0.05);
}

/** Életlen/bemozdult: a finom részletek eltűntek, vagy szinte semmi éles átmenet nincs. */
export function isBlurry(q: Pick<RawQuality, 'sharpness' | 'blurRatio'>, threshold: number): boolean {
  return q.blurRatio < BLUR_RATIO_LIMIT || q.sharpness < threshold;
}

/** Expozíciós pontszám: 1 a középtónusoknál, a széleken csökken. */
export function exposureScore(brightness: number): number {
  const d = Math.abs(brightness - 0.48);
  return Math.max(0, 1 - (d / 0.42) ** 2);
}

/**
 * Összesített pontszám 0–1 között. Az élességet a sorozaton belül
 * normalizáljuk (logaritmikus skála), mert az abszolút érték erősen függ a
 * témától.
 */
export function qualityScore(q: RawQuality, maxLogSharpness: number): number {
  const detail = maxLogSharpness > 0 ? Math.min(1, Math.log1p(q.sharpness) / maxLogSharpness) : 0;
  const crisp = Math.min(1, Math.max(0, (q.blurRatio - 0.3) / 0.5));
  const contrast = Math.min(1, q.contrast / 0.25);
  return 0.35 * detail + 0.2 * crisp + 0.3 * exposureScore(q.brightness) + 0.15 * contrast;
}

/**
 * Minőségi jelzők alkalmazása a képek egy halmazán (helyben módosít):
 * pontszám, `blurry` és `dark` kizárás. A duplikátumokat külön lépés kezeli.
 */
export function applyQuality(photos: Photo[]): void {
  const sharpValues = photos.map((p) => p.quality.sharpness);
  const threshold = blurThreshold(sharpValues);
  const maxLog = Math.max(0, ...sharpValues.map((s) => Math.log1p(s)));
  for (const p of photos) {
    const raw = p.quality;
    p.quality.score = qualityScore(raw, maxLog);
    if (p.excludedReason === 'user') continue;
    if (isTooDark(raw)) {
      p.excludedReason = 'dark';
      p.included = false;
    } else if (isBlurry(raw, threshold)) {
      p.excludedReason = 'blurry';
      p.included = false;
    }
  }
}
