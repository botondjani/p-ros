import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useStory } from './context';
import { Hero } from './Hero';
import { ChapterSection } from './ChapterSection';
import { StatsSection } from './StatsSection';
import { Finale } from './Finale';
import { LightboxProvider } from './Lightbox';

const MapPanel = lazy(() => import('./MapPanel'));

/** Melyik fejezet van épp a képernyő közepén – ehhez repül a térkép. */
function useActiveChapter(ids: string[]) {
  const [active, setActive] = useState<string | undefined>(ids[0]);
  const refs = useRef(new Map<string, HTMLElement>());
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      // mobilon a térképsáv alatti terület közepe számít
      const mid = window.innerHeight * (window.innerWidth >= 1024 ? 0.5 : 0.62);
      let best: string | undefined;
      for (const id of ids) {
        const el = refs.current.get(id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top <= mid) best = id;
      }
      setActive(best ?? ids[0]);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [ids.join(',')]);
  const register = (id: string) => (el: HTMLElement | null) => {
    if (el) refs.current.set(id, el);
    else refs.current.delete(id);
  };
  return { active, register };
}

export function Story() {
  const { project } = useStory();
  const ids = project.chapters.map((c) => c.id);
  const { active, register } = useActiveChapter(ids);
  const hasMap = project.chapters.some((c) => c.location);

  return (
    <LightboxProvider>
      <div className="grain">
        <Hero />
        <div id="fejezetek" className={hasMap ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]' : ''}>
          {hasMap && (
            <div className="sticky top-[3.25rem] z-20 h-[34svh] border-b border-line lg:order-2 lg:h-[calc(100svh-3.25rem)] lg:border-b-0 lg:border-l">
              <Suspense fallback={<div className="h-full w-full bg-soft" />}>
                <MapPanel activeChapterId={active} />
              </Suspense>
            </div>
          )}
          <div className={`px-5 sm:px-10 lg:order-1 lg:px-16 ${hasMap ? '' : 'mx-auto max-w-3xl'}`}>
            {project.chapters.map((c, i) => (
              <ChapterSection key={c.id} ref={register(c.id)} chapter={c} index={i} />
            ))}
          </div>
        </div>
        <StatsSection />
        <Finale />
      </div>
    </LightboxProvider>
  );
}
