import { lazy, Suspense, useCallback, useEffect } from 'react';
import { useStore } from '../model/store';
import { Landing } from './Landing';
import { Processing } from './Processing';
import { restoreSaved, startFiles } from './flow';
import { useFileDrop } from './useFileDrop';
import { THEME_BG } from './themes';
import { IconUpload } from '../lib/icons';

const StoryView = lazy(() => import('./StoryView'));

export function App() {
  const view = useStore((s) => s.view);
  const project = useStore((s) => s.project);
  const error = useStore((s) => s.error);
  const setError = useStore((s) => s.setError);

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
        <Suspense fallback={<Processing />}>
          <StoryView />
        </Suspense>
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
