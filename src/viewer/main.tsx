import { StrictMode, useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import type { Project } from '../model/types';
import { Story } from '../story/Story';
import { StoryContext } from '../story/context';
import { decryptText, fromBase64 } from '../export/crypto';
import type { DecryptedBundle } from '../export/types';
import { THEME_BG } from '../app/themes';

/**
 * Az exportált, önálló oldal. Adat: window.__IDOKAPSZULA__ (data.js).
 * Nincs szerver, nincs állapotmentés; csak a térképcsempék jönnek a
 * hálózatról, ha van.
 */
function Viewer({ project }: { project: Project }) {
  useEffect(() => {
    document.documentElement.dataset.theme = project.theme;
    document.title = project.title;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BG[project.theme]);
  }, [project]);
  return (
    <StoryContext.Provider value={{ project, projectId: project.id, editing: false, standalone: true }}>
      <main>
        <Story />
      </main>
      <footer className="px-5 pb-10 text-center text-xs text-muted">Készült az Időkapszulával</footer>
    </StoryContext.Provider>
  );
}

function Unlock({ onUnlock }: { onUnlock(p: Project): void }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const data = window.__IDOKAPSZULA__;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (data?.kind !== 'encrypted') return;
    if (!crypto?.subtle) {
      setErr('Ez a böngésző itt nem tud titkosítást feloldani (https vagy helyi fájl kell).');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const bundle = JSON.parse(await decryptText(data.payload, pw)) as DecryptedBundle;
      const urls: Record<string, string> = {};
      for (const [path, b64] of Object.entries(bundle.images)) urls[path] = URL.createObjectURL(new Blob([fromBase64(b64)], { type: 'image/jpeg' }));
      const photos = Object.fromEntries(
        Object.entries(bundle.project.photos).map(([id, p]) => [id, p.src ? { ...p, src: { display: urls[p.src.display], thumb: urls[p.src.thumb] } } : p]),
      );
      onUnlock({ ...bundle.project, photos });
    } catch {
      setErr('Ez nem a jó jelszó.');
      setBusy(false);
    }
  };

  return (
    <main className="grain flex min-h-svh items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm text-center">
        <p className="eyebrow mb-5">Időkapszula</p>
        <h1 className="font-display text-4xl font-[380]">Neked szól.</h1>
        <p className="mt-3 text-muted">Add meg a jelszót, amit kaptál.</p>
        <input
          type="password"
          value={pw}
          autoFocus
          onChange={(e) => setPw(e.target.value)}
          className="mt-8 w-full rounded-full border border-line bg-paper px-5 py-3.5 text-center text-lg outline-none focus:border-accent"
          aria-label="Jelszó"
        />
        {err && <p role="alert" className="mt-3 text-sm text-accent">{err}</p>}
        <button disabled={busy || !pw} className="mt-5 w-full rounded-full bg-accent px-6 py-3.5 font-semibold text-accent-ink disabled:opacity-50">
          {busy ? 'Kinyitom…' : 'Kinyitom'}
        </button>
      </form>
    </main>
  );
}

/**
 * Egyfájlos megosztás: a képek a fájlban lévő statikus album <img> elemeiben
 * vannak; a photo.src (#id) helyére azok data: URI-ja kerül, az albumot pedig
 * eltüntetjük, mert a megjelenítő átveszi a helyét.
 */
function resolveInline(project: Project): Project {
  const photos = Object.fromEntries(
    Object.entries(project.photos).map(([id, p]) => {
      const el = p.src?.display.startsWith('#') ? (document.getElementById(p.src.display.slice(1)) as HTMLImageElement | null) : null;
      return [id, el ? { ...p, src: { display: el.src, thumb: el.src } } : p];
    }),
  );
  return { ...project, photos };
}

function Root() {
  const data = window.__IDOKAPSZULA__;
  const [project, setProject] = useState<Project | undefined>(initial);
  if (!data) return <p className="p-8">Hiányzik az adatfájl (data.js).</p>;
  if (project) return <Viewer project={project} />;
  return <Unlock onUnlock={setProject} />;
}

// Egyetlen fájlban nincs térkép-worker (és file:// alól amúgy sem indulna): az útvonalvázlat látszik.
if (window.__IDOKAPSZULA__?.kind !== 'plain') (globalThis as { __IK_NO_MAP__?: boolean }).__IK_NO_MAP__ = true;

// a képeket előbb kiolvassuk a statikus albumból, csak utána vesszük ki
const boot = window.__IDOKAPSZULA__;
const initial = boot?.kind === 'plain' ? boot.project : boot?.kind === 'inline' ? resolveInline(boot.project) : undefined;
document.getElementById('ik-static')?.remove();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
