// Ideiglenes helyőrző – a (d) lépésben MapLibre-térkép váltja.
import { useStory } from './context';

export default function MapPanel({ activeChapterId }: { activeChapterId?: string }) {
  const { project } = useStory();
  const c = project.chapters.find((x) => x.id === activeChapterId);
  return (
    <div className="grain flex h-full w-full items-center justify-center bg-soft">
      <p className="font-display text-2xl italic text-muted">{c?.location?.name ?? c?.title}</p>
    </div>
  );
}
