import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../model/store';
import { Landing } from './Landing';
import { Processing } from './Processing';
import { TopBar } from './TopBar';
import { Story } from '../story/Story';
import { StoryContext } from '../story/context';
import { restoreSaved, startFiles } from './flow';
import { useFileDrop } from './useFileDrop';
import { THEME_BG } from './themes';
import { IconUpload } from '../lib/icons';

export function App() {
  const view = useStore((s) => s.view);
  const project = useStore((s) => s.project);
  const editing = useStore((s) => s.editing);
  const error = useStore((s) => s.error);
  const setError = useStore((s) => s.setError);
  const [, setPanel] = useState<'export' | 'enhance' | null>(null);

  useEffect(() => {
    restoreSaved();
  }, []);

  const theme = view === 'story' && project ? project.theme : 'papir';
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BG[theme]);
  }, [theme]);

  const onFiles = useCallback((files: File[]) => {
    if (useStore.getState().view === 'processing') return;
    startFiles(files);
  }, []);
  const dragging = useFileDrop(onFiles, view !== 'processing');

  return (
    <>
      {view === 'landing' && <Landing />}
      {view === 'processing' && <Processing />}
      {view === 'story' && project && (
        <StoryContext.Provider value={{ project, projectId: project.id, editing, standalone: false }}>
          <TopBar onExport={() => setPanel('export')} onEnhance={() => setPanel('enhance')} />
          <main>
            <Story />
          </main>
          <footer className="px-5 pb-10 text-center text-xs text-muted">
            Készült az Időkapszulával · a képek nem hagyták el ezt a gépet
            {project.isDemo && <span className="block mt-1">Mintaképek: Unsplash License · az időpontok és helyek illusztratívak</span>}
          </footer>
        </StoryContext.Provider>
      )}

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-bg/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-accent px-16 py-14 text-center">
            <IconUpload width={36} height={36} className="text-accent" />
            <p className="font-display text-3xl">Engedd el, és kezdjük</p>
            <p className="text-sm text-muted">A képek a böngésződben maradnak.</p>
          </div>
        </div>
      )}

      {error && view === 'story' && (
        <div role="alert" className="fixed inset-x-3 bottom-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-bg shadow-xl">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(undefined)} className="opacity-70 hover:opacity-100">
            Bezár
          </button>
        </div>
      )}
    </>
  );
}
