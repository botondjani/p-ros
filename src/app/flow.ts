import { useStore } from '../model/store';
import type { Source } from '../model/types';
import { ingest } from '../pipeline/ingest';
import { analyze } from '../analysis/analyze';
import type { BuildOptions } from '../analysis/build';
import { loadPlaces } from '../analysis/places';
import { demoSource, loadDemoManifest } from '../sources/DemoSource';
import { fileSource } from '../sources/FileSource';
import { clearProject, loadProject } from '../model/persist';
import { deleteProjectImages } from '../lib/images';
import { uid } from '../lib/id';

async function run(sources: Source[], opts: Pick<BuildOptions, 'isDemo' | 'title' | 'finalMessage' | 'landmarks'>) {
  const s = useStore.getState();
  const old = s.project;
  const projectId = opts.isDemo ? 'demo' : uid('p_');
  const total = sources.reduce((n, src) => n + src.count, 0);
  s.setError(undefined);
  s.setEditing(false);
  s.setProcessing({ phase: 'reading', done: 0, total, failed: [], startedAt: performance.now() });
  s.setView('processing');

  try {
    const placesPromise = loadPlaces();
    const photos = await ingest(sources, projectId, (p) =>
      useStore.getState().setProcessing({ ...useStore.getState().processing!, phase: 'reading', ...p }),
    );
    if (!photos.length) throw new Error('Egyetlen képet sem sikerült beolvasni.');
    useStore.getState().setProcessing({ ...useStore.getState().processing!, phase: 'analyzing' });
    const places = await placesPromise;
    const project = analyze(photos, { ...opts, places });
    project.id = projectId;
    if (old && old.id !== projectId) deleteProjectImages(old.id);
    const st = useStore.getState();
    st.setProject(project);
    st.setProcessing({ ...st.processing!, phase: 'done' });
    st.setView('story');
    window.scrollTo({ top: 0 });
  } catch (e) {
    const st = useStore.getState();
    st.setError(e instanceof Error ? e.message : String(e));
    st.setView(old ? 'story' : 'landing');
    st.setProcessing(undefined);
  }
}

export async function startDemo() {
  const s = useStore.getState();
  s.setView('processing');
  s.setProcessing({ phase: 'loading', done: 0, total: 0, failed: [], startedAt: performance.now() });
  try {
    const manifest = await loadDemoManifest();
    await run([demoSource(manifest)], {
      isDemo: true,
      title: manifest.title,
      finalMessage: manifest.finalMessage,
      landmarks: manifest.landmarks,
    });
  } catch (e) {
    s.setError(e instanceof Error ? e.message : String(e));
    s.setView('landing');
  }
}

export async function startFiles(files: File[]) {
  const src = fileSource(files);
  if (!src.count) {
    useStore.getState().setError('Nem találtunk képfájlt a kiválasztottak között.');
    return;
  }
  await run([src], {});
}

export async function restoreSaved() {
  const p = await loadProject();
  if (p) useStore.getState().setSavedProject({ id: p.id, title: p.title, subtitle: p.subtitle });
}

export async function openSaved() {
  const p = await loadProject();
  if (!p) return;
  const s = useStore.getState();
  s.setProject(p);
  s.setView('story');
  window.scrollTo({ top: 0 });
}

export async function resetAll() {
  const s = useStore.getState();
  const p = s.project;
  if (p) await deleteProjectImages(p.id);
  await clearProject();
  s.setProject(undefined);
  s.setSavedProject(undefined);
  s.setEditing(false);
  s.setView('landing');
  window.scrollTo({ top: 0 });
}
