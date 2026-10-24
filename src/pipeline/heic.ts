/** HEIC/HEIF felismerése kiterjesztés, MIME-típus vagy a fájl fejléce alapján. */
export async function isHeic(blob: Blob, name: string): Promise<boolean> {
  if (/\.(heic|heif)$/i.test(name) || /image\/hei[cf]/.test(blob.type)) return true;
  try {
    const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    const brand = String.fromCharCode(...head.slice(4, 12));
    return /^ftyp(heic|heix|hevc|hevx|mif1|msf1)/.test(brand);
  } catch {
    return false;
  }
}

/**
 * HEIC → JPEG konverzió a fő szálon (a heic2any DOM-ot használ). Lustán
 * töltjük be, mert nagy; csak akkor kell, ha a böngésző maga nem tudja
 * dekódolni (Safari tudja).
 */
export async function convertHeic(blob: Blob): Promise<Blob> {
  const { default: heic2any } = await import('heic2any');
  const out = await heic2any({ blob, toType: 'image/jpeg', quality: 0.9 });
  return Array.isArray(out) ? out[0] : out;
}
