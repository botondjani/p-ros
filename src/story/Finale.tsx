import { useStory } from './context';
import { useStore } from '../model/store';
import { EditableText } from './EditableText';
import { useReveal } from './useReveal';

export function Finale() {
  const { project, editing } = useStory();
  const updateProject = useStore((s) => s.updateProject);
  const ref = useReveal<HTMLDivElement>();
  const empty = !project.finalMessage.trim();

  return (
    <section className="px-5 py-28 sm:px-10" aria-label="Személyes üzenet">
      <div ref={ref} className="reveal mx-auto max-w-2xl text-center">
        <p className="eyebrow mb-8">Utóirat</p>
        {empty && !editing ? (
          <p className="font-display text-[clamp(2rem,5vw,3.2rem)] font-[350] italic">Folytatjuk.</p>
        ) : (
          <div className="font-display whitespace-pre-line text-[clamp(1.25rem,2.6vw,1.6rem)] font-[350] italic leading-[1.6]">
            <EditableText
              value={project.finalMessage}
              editing={editing}
              multiline
              label="Személyes üzenet"
              placeholder="Írj ide valamit annak, akinek ezt adod…"
              onChange={(finalMessage) => updateProject({ finalMessage })}
              className="text-center"
            />
          </div>
        )}
        <div className="mx-auto mt-12 h-px w-16 bg-accent" />
      </div>
    </section>
  );
}
