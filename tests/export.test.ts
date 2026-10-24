import { describe, expect, it } from 'vitest';
import { decryptText, encryptText, fromBase64, toBase64 } from '../src/export/crypto';
import { sanitizeForExport } from '../src/export/sanitize';
import { slugify, viewerHtml } from '../src/export/buildZip';
import { buildProject } from '../src/analysis/build';
import { photo } from './helpers';

describe('crypto', () => {
  it('oda-vissza titkosít, ékezetes szöveggel is', async () => {
    const text = JSON.stringify({ üzenet: 'Szeretlek – ő, ű, 🌅', n: 42 });
    const enc = await encryptText(text, 'titok');
    expect(enc.data).not.toContain('Szeretlek');
    expect(await decryptText(enc, 'titok')).toBe(text);
  });
  it('rossz jelszóra hibát dob', async () => {
    const enc = await encryptText('x', 'jo');
    await expect(decryptText(enc, 'rossz')).rejects.toThrow();
  });
  it('minden titkosítás új sót és IV-t használ', async () => {
    const a = await encryptText('x', 'p');
    const b = await encryptText('x', 'p');
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
  });
  it('base64 nagy bináris adatra is', () => {
    const bytes = new Uint8Array(200_000).map((_, i) => i % 251);
    expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes));
  });
});

describe('sanitizeForExport', () => {
  const T = new Date(2025, 4, 14, 10).getTime();
  const gps = { lat: 38.72, lng: -9.14 };
  const photos = [
    photo({ takenAt: T, gps, fileName: 'IMG_0001.HEIC', quality: { score: 0.9, hash: '1111111111111111' } }),
    photo({ takenAt: T + 3_600_000, gps, fileName: 'IMG_0002.HEIC', quality: { score: 0.8, hash: '2222222222222222' } }),
    photo({ takenAt: T + 7_200_000, gps, fileName: 'IMG_0003.HEIC', quality: { score: 0.7, hash: '3333333333333333' } }),
    photo({ takenAt: T + 9_000_000, gps, fileName: 'IMG_0004.HEIC', excludedReason: 'blurry', included: false }),
  ];
  const project = buildProject(photos);

  it('csak a látható képeket viszi, fájlnév és képenkénti GPS nélkül', () => {
    const { project: clean, photos: list } = sanitizeForExport(project);
    const exported = Object.values(clean.photos);
    expect(exported.length).toBe(Object.values(project.photos).filter((p) => p.included).length);
    for (const p of exported) {
      expect(p.fileName).toBe('');
      expect(p.gps).toBeUndefined();
      expect(p.src?.display).toMatch(/^img\/\d{3}\.jpg$/);
    }
    expect(list).toHaveLength(exported.length);
    expect(JSON.stringify(clean)).not.toContain('IMG_000');
    expect(clean.photoTotal).toBe(4);
  });

  it('a fejezet helye megmarad, a kiemelt kép érvényes', () => {
    const { project: clean } = sanitizeForExport(project);
    for (const c of clean.chapters) {
      expect(c.location).toBeDefined();
      expect(c.photoIds).toContain(c.heroPhotoId);
    }
  });
});

describe('export segédek', () => {
  it('slugify ékezetekkel', () => {
    expect(slugify('Portugália, tavasszal!')).toBe('portugalia-tavasszal');
    expect(slugify('***')).toBe('idokapszula');
  });
  it('a HTML klasszikus scripteket használ (file:// miatt), és escape-eli a címet', () => {
    const html = viewerHtml('<Mi> & "ők"', 'papir', false);
    expect(html).toContain('<script src="viewer.js"></script>');
    expect(html).not.toContain('type="module"');
    expect(html).toContain('&lt;Mi&gt; &amp; &quot;ők&quot;');
  });
  it('jelszavas exportban a cím nem szivárog ki a HTML-be', () => {
    expect(viewerHtml('Titkos utunk', 'papir', true)).not.toContain('Titkos utunk');
  });
});

describe('egyfájlos megosztás', async () => {
  const { scriptSafe } = await import('../src/export/singleFile');
  it('a beágyazott script nem zárható le idő előtt', () => {
    const out = scriptSafe('var a = "</script><script>alert(1)</script>"; // <!-- x');
    expect(out).not.toMatch(/<\/script/i);
    expect(out).not.toContain('<!--');
    // JavaScriptként ugyanazt jelenti
    expect(new Function(`${out.split('//')[0]}; return a;`)()).toBe('</script><script>alert(1)</script>');
  });
});
