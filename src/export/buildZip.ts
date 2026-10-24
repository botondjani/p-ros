import JSZip from 'jszip';
import type { Project } from '../model/types';
import { getImageBlob } from '../lib/images';
import { sanitizeForExport } from './sanitize';
import { encryptText, toBase64 } from './crypto';
import type { DecryptedBundle, ExportData } from './types';
import { THEME_BG } from '../app/themes';
import { IS_ARTIFACT, useCapability, type DownloadsApi } from '../lib/runtime';

export interface ExportOptions {
  password?: string;
  onProgress?(done: number, total: number): void;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function slugify(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'idokapszula'
  );
}

/** Az önálló oldal HTML-je. Klasszikus (nem modul) scriptek, így file://-ról is fut. */
export function viewerHtml(title: string, theme: Project['theme'], encrypted: boolean): string {
  return `<!doctype html>
<html lang="hu" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="${THEME_BG[theme]}">
<title>${escapeHtml(encrypted ? 'Időkapszula' : title)}</title>
<link rel="stylesheet" href="viewer.css">
<style>html,body{background:${THEME_BG[theme]}}</style>
</head>
<body>
<div id="root"></div>
<noscript><p style="font-family:Georgia,serif;padding:2rem">Ez az oldal JavaScriptet igényel.</p></noscript>
<script src="data.js"></script>
<script src="viewer.js"></script>
</body>
</html>
`;
}

async function fetchViewerFiles(): Promise<{ path: string; data: Blob }[]> {
  const base = `${import.meta.env.BASE_URL}viewer/`;
  const list = (await fetch(`${base}files.json`).then((r) => {
    if (!r.ok) throw new Error('A megjelenítő fájljai hiányoznak (futtasd: npm run build:viewer).');
    return r.json();
  })) as string[];
  return Promise.all(
    list.map(async (path) => {
      const r = await fetch(base + path);
      if (!r.ok) throw new Error(`Hiányzó fájl: ${path}`);
      return { path, data: await r.blob() };
    }),
  );
}

/**
 * Önálló, statikus oldal zip-ben: index.html + megjelenítő + data.js +
 * kicsinyített képek. Csak a látható képek kerülnek bele, fájlnevek és
 * képenkénti GPS nélkül.
 */
export async function buildZip(project: Project, opts: ExportOptions = {}): Promise<{ blob: Blob; fileName: string }> {
  const { project: clean, photos } = sanitizeForExport(project);
  const zip = new JSZip();
  const total = photos.length * 2 + 1;
  let done = 0;
  const tick = () => opts.onProgress?.(++done, total);

  for (const f of await fetchViewerFiles()) zip.file(f.path, f.data);
  tick();

  const images: Record<string, Blob> = {};
  for (const p of photos) {
    const [d, t] = await Promise.all([getImageBlob(project.id, p.photo.id, 'display'), getImageBlob(project.id, p.photo.id, 'thumb')]);
    if (!d || !t) throw new Error('Néhány kép hiányzik a böngésző tárából. Töltsd be újra a képeket.');
    images[p.display] = d;
    tick();
    images[p.thumb] = t;
    tick();
  }

  let data: ExportData;
  if (opts.password) {
    const encoded: DecryptedBundle = { project: clean, images: {} };
    for (const [path, blob] of Object.entries(images)) encoded.images[path] = toBase64(new Uint8Array(await blob.arrayBuffer()));
    data = { kind: 'encrypted', title: 'Időkapszula', payload: await encryptText(JSON.stringify(encoded), opts.password) };
  } else {
    data = { kind: 'plain', project: clean };
    for (const [path, blob] of Object.entries(images)) zip.file(path, blob, { compression: 'STORE' });
  }

  zip.file('data.js', `window.__IDOKAPSZULA__ = ${JSON.stringify(data)};\n`);
  zip.file('index.html', viewerHtml(clean.title, clean.theme, !!opts.password));
  zip.file(
    'OLVASS-EL.txt',
    [
      'Időkapszula – önálló oldal',
      '',
      'Nyisd meg az index.html-t egy böngészőben, vagy töltsd fel a mappa teljes tartalmát',
      'bármilyen statikus tárhelyre (pl. app.netlify.com/drop, GitHub Pages, saját szerver).',
      '',
      'A térkép csempéi az OpenFreeMap-ről töltődnek be, ha van internet; nélküle az út vázlata látszik.',
      opts.password ? '\nAz oldal jelszóval védett. Ez egyszerű védelem: véd a véletlen betekintés ellen, de nem erős titkosítás.' : '',
    ].join('\n'),
  );

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  return { blob, fileName: `${slugify(clean.title)}.zip` };
}

/** Letöltés. Az Artifactban a böngésző tiltja a közvetlen letöltést, ott a claude.ai `downloads` képessége menti (a user jóváhagyja). */
export async function downloadBlob(blob: Blob, fileName: string): Promise<void> {
  if (IS_ARTIFACT) {
    const downloads = await useCapability<DownloadsApi>('downloads');
    if (!downloads) throw new Error('Ebben a nézetben nem lehet letölteni.');
    try {
      await downloads.save({ filename: fileName, data: blob });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      throw new Error(code === 'declined' ? 'A letöltést elutasítottad.' : 'A letöltés nem sikerült.');
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
