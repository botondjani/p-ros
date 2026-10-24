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

interface HeifImage {
  get_width(): number;
  get_height(): number;
  display(target: { data: Uint8ClampedArray; width: number; height: number }, cb: (d: { data: Uint8ClampedArray } | null) => void): void;
  free?(): void;
}
interface HeifModule {
  HeifDecoder: new () => { decode(buf: Uint8Array): HeifImage[] };
}

let lib: HeifModule | undefined;

/**
 * HEIC dekódolás a workerben, libheif WebAssembly-vel. Csak akkor töltődik
 * be (≈2 MB), ha a böngésző maga nem tudja a HEIC-et (Safari tudja), és
 * minden worker párhuzamosan dekódol.
 */
export async function decodeHeic(blob: Blob): Promise<ImageBitmap> {
  if (!lib) {
    // @ts-expect-error – a csomagnak nincs típusdeklarációja ehhez a belépési ponthoz
    const { default: factory } = await import('libheif-js/libheif-wasm/libheif-bundle.mjs');
    lib = factory() as HeifModule;
  }
  const decoder = new lib.HeifDecoder();
  const images = decoder.decode(new Uint8Array(await blob.arrayBuffer()));
  if (!images.length) throw new Error('üres HEIC');
  const img = images[0];
  const width = img.get_width();
  const height = img.get_height();
  try {
    const pixels = await new Promise<Uint8ClampedArray>((resolve, reject) =>
      img.display({ data: new Uint8ClampedArray(width * height * 4), width, height }, (d) =>
        d ? resolve(d.data) : reject(new Error('HEIC dekódolás sikertelen')),
      ),
    );
    return await createImageBitmap(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, width, height));
  } finally {
    for (const im of images) im.free?.();
  }
}
