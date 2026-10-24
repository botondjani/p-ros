import type { Project } from '../model/types';
import { getImageBlob } from '../lib/images';
import { sanitizeForExport } from './sanitize';
import { encryptText, toBase64 } from './crypto';
import type { DecryptedBundle, ExportData } from './types';
import { THEME_BG } from '../app/themes';
import { escapeHtml, slugify } from './buildZip';
import { capitalize, formatDay, formatRange, formatWeekday } from '../lib/format';

/**
 * Megosztás egyetlen HTML-fájlként, szerver nélkül. A fájl mindent tartalmaz
 * (megjelenítő, betűtípusok, kicsinyített képek), így e-mailben vagy
 * üzenetben elküldhető. JavaScript nélkül (pl. telefonos előnézetben) egy
 * egyszerű, statikus album látszik ugyanazokkal a képekkel.
 */

export interface SingleFileOptions {
  password?: string;
  onProgress?(done: number, total: number): void;
}

const MAX_EDGE = 1280;

async function blobToDataUrl(blob: Blob): Promise<string> {
  return `data:${blob.type || 'application/octet-stream'};base64,${toBase64(new Uint8Array(await blob.arrayBuffer()))}`;
}

/** Megosztáshoz kisebbre: legfeljebb 1280 px, hogy a fájl üzenetben is elférjen. */
async function shrink(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const s = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  if (s === 1 && blob.type === 'image/jpeg') {
    bmp.close();
    return blob;
  }
  const canvas = new OffscreenCanvas(Math.round(bmp.width * s), Math.round(bmp.height * s));
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
}

/** Inline <script>-be tehető szöveg (a </script> nem zárhatja le idő előtt). */
export const scriptSafe = (s: string) => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

async function viewerAssets(): Promise<{ js: string; css: string }> {
  const base = `${import.meta.env.BASE_URL}viewer/`;
  const get = async (path: string) => {
    const r = await fetch(base + path);
    if (!r.ok) throw new Error(`Hiányzó fájl: ${path} (futtasd: npm run build:viewer)`);
    return r;
  };
  const [js, cssRaw] = await Promise.all([get('viewer.js').then((r) => r.text()), get('viewer.css').then((r) => r.text())]);
  // betűtípusok beágyazása a CSS-be
  const urls = [...new Set([...cssRaw.matchAll(/url\((\.\/assets\/[^)]+\.woff2)\)/g)].map((m) => m[1]))];
  let css = cssRaw;
  for (const u of urls) {
    const data = await blobToDataUrl(new Blob([await (await get(u.replace('./', ''))).arrayBuffer()], { type: 'font/woff2' }));
    css = css.split(`url(${u})`).join(`url(${data})`);
  }
  return { js, css };
}

function chapterWhen(start: number, end: number): string {
  if (!Number.isFinite(start)) return '';
  return new Date(start).toDateString() === new Date(end).toDateString()
    ? capitalize(`${formatDay(start)}, ${formatWeekday(start)}`)
    : formatRange(start, end);
}

/** JavaScript nélkül is olvasható album (a képek data: URI-k, a megjelenítő ezeket használja újra). */
function staticAlbum(project: Project, images: Map<string, string>): string {
  const img = (id: string) => {
    const p = project.photos[id];
    const ref = p.src!.display.slice(1);
    const cap = p.caption ? `<figcaption>${escapeHtml(p.caption)}</figcaption>` : '';
    return `<figure><img id="${ref}" src="${images.get(ref)}" alt="${escapeHtml(p.caption ?? '')}" width="${p.width}" height="${p.height}">${cap}</figure>`;
  };
  const chapters = project.chapters
    .map((c) => {
      const ordered = c.heroPhotoId ? [c.heroPhotoId, ...c.photoIds.filter((id) => id !== c.heroPhotoId)] : c.photoIds;
      const place = c.location?.name ? ` · ${escapeHtml(c.location.name)}` : '';
      return `<section><p class="m">${escapeHtml(chapterWhen(c.dateRange.start, c.dateRange.end))}${place}</p><h2>${escapeHtml(c.title)}</h2>${
        c.summary ? `<p class="s">${escapeHtml(c.summary)}</p>` : ''
      }${ordered.map(img).join('')}</section>`;
    })
    .join('');
  const msg = project.finalMessage.trim() ? `<section class="f"><p>${escapeHtml(project.finalMessage).replace(/\n/g, '<br>')}</p></section>` : '';
  return `<header><p class="m">${escapeHtml(project.subtitle)}</p><h1>${escapeHtml(project.title)}</h1></header>${chapters}${msg}`;
}

const STATIC_CSS = `#ik-static{max-width:720px;margin:0 auto;padding:32px 16px 64px;font-family:Georgia,'Times New Roman',serif;color:#2b2420;line-height:1.5}
#ik-static h1{font-size:2.4em;font-weight:normal;margin:.2em 0 .6em;line-height:1.1}#ik-static h2{font-size:1.7em;font-weight:normal;margin:.1em 0 .3em}
#ik-static .m{font:600 12px/1.4 -apple-system,system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#7a6d62;margin:0}
#ik-static .s{font-style:italic;color:#7a6d62;margin:0 0 1em}#ik-static section{margin:56px 0}#ik-static figure{margin:0 0 12px}
#ik-static img{display:block;width:100%;height:auto;border-radius:3px}#ik-static figcaption{font-style:italic;color:#7a6d62;font-size:.9em;margin-top:4px}
#ik-static .f{text-align:center;font-style:italic;font-size:1.25em}`;

export async function buildSingleHtml(project: Project, opts: SingleFileOptions = {}): Promise<{ blob: Blob; fileName: string }> {
  const { project: clean, photos } = sanitizeForExport(project);
  const total = photos.length + 1;
  let done = 0;
  const tick = () => opts.onProgress?.(++done, total);

  const assets = await viewerAssets();
  tick();

  // képek: egyszer tároljuk, a photo.src a megfelelő <img> elemre mutat
  const images = new Map<string, string>();
  const seen = new Map<string, string>();
  let n = 0;
  for (const p of photos) {
    const blob = await getImageBlob(project.id, p.photo.id, 'display');
    if (!blob) throw new Error('Néhány kép hiányzik a böngésző tárából. Töltsd be újra a képeket.');
    let ref = seen.get(p.photo.id);
    if (!ref) {
      ref = `ik-img-${String(++n).padStart(3, '0')}`;
      seen.set(p.photo.id, ref);
      images.set(ref, await blobToDataUrl(await shrink(blob)));
    }
    clean.photos[p.photo.id].src = { display: `#${ref}`, thumb: `#${ref}` };
    tick();
  }

  let data: ExportData;
  let body: string;
  if (opts.password) {
    const bundle: DecryptedBundle = { project: clean, images: {} };
    for (const [ref, url] of images) bundle.images[`#${ref}`] = url.slice(url.indexOf(',') + 1);
    data = { kind: 'encrypted', title: 'Időkapszula', payload: await encryptText(JSON.stringify(bundle), opts.password) };
    body = `<header><h1>Időkapszula</h1></header><p>Ez az emlék jelszóval védett. Nyisd meg egy böngészőben (Chrome, Safari, Firefox), és add meg a jelszót, amit kaptál.</p>`;
  } else {
    data = { kind: 'inline', project: clean };
    body = staticAlbum(clean, images);
  }

  const title = opts.password ? 'Időkapszula' : clean.title;
  const html = `<!doctype html>
<html lang="hu" data-theme="${clean.theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="${THEME_BG[clean.theme]}">
<title>${escapeHtml(title)}</title>
<style>${STATIC_CSS}</style>
<style>${assets.css}</style>
<style>html,body{background:${THEME_BG[clean.theme]}}</style>
</head>
<body>
<div id="root"></div>
<div id="ik-static">${body}</div>
<script>window.__IDOKAPSZULA__ = ${scriptSafe(JSON.stringify(data))};</script>
<script>${scriptSafe(assets.js)}</script>
</body>
</html>
`;
  return { blob: new Blob([html], { type: 'text/html' }), fileName: `${slugify(clean.title)}.html` };
}

/** Megosztás a rendszer megosztás-menüjével (telefonon), ha a böngésző tud fájlt megosztani. */
export function canShareFiles(): boolean {
  try {
    const probe = new File(['x'], 'probe.html', { type: 'text/html' });
    return typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [probe] });
  } catch {
    return false;
  }
}

export async function shareFile(blob: Blob, fileName: string, title: string): Promise<'shared' | 'cancelled'> {
  const file = new File([blob], fileName, { type: 'text/html' });
  try {
    await navigator.share({ files: [file], title, text: 'Nyisd meg böngészőben.' });
    return 'shared';
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'cancelled';
    throw e;
  }
}
