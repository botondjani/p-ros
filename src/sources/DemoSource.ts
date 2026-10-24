import type { RawItem, Source } from '../model/types';

export interface DemoManifest {
  title: string;
  finalMessage: string;
  items: { file: string; takenAt: string; lat?: number; lng?: number }[];
  landmarks?: { name: string; lat: number; lng: number }[];
  credits: { license: string; authors: string[]; note: string };
}

const base = () => `${import.meta.env.BASE_URL}demo/`;

export async function loadDemoManifest(): Promise<DemoManifest> {
  const r = await fetch(`${base()}demo.json`);
  if (!r.ok) throw new Error('A mintaadatok nem tölthetők be');
  return r.json();
}

/**
 * Beépített mintaképek. A kicsinyített webp-kből hiányzik az EXIF, ezért az
 * időt és a helyet a manifest adja meg; a többi (minőség, hash, válogatás)
 * ugyanazon a láncon megy át, mint a feltöltött képek.
 */
export function demoSource(manifest: DemoManifest): Source {
  return {
    id: 'demo',
    kind: 'demo',
    label: 'Mintaképek',
    count: manifest.items.length,
    async *items(): AsyncIterable<RawItem> {
      // párhuzamos letöltés, sorrendben átadva
      const fetches = manifest.items.map((it) => fetch(base() + it.file).then((r) => r.blob()));
      for (let i = 0; i < manifest.items.length; i++) {
        const it = manifest.items[i];
        const blob = await fetches[i];
        const [y, mo, d, h, mi, s] = it.takenAt.split(/[-T:]/).map(Number);
        yield {
          id: `demo_${it.file.replace(/\.\w+$/, '')}`,
          name: it.file,
          blob,
          meta: {
            takenAt: new Date(y, mo - 1, d, h, mi, s).getTime(),
            gps: it.lat != null && it.lng != null ? { lat: it.lat, lng: it.lng } : undefined,
          },
        };
      }
    },
  };
}
