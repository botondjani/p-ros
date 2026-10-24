import { useEffect, useState } from 'react';
import type { Project } from '../model/types';
import { StoryContext } from '../story/context';
import { Story } from '../story/Story';
import { loadDemoProject } from './demoProject';

/** A kész minta a landing alján: ugyanaz a nézet, amit a user a saját képeiből kap. */
export default function DemoPreview() {
  const [project, setProject] = useState<Project>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    loadDemoProject().then(setProject, () => setFailed(true));
  }, []);

  if (failed) return null;
  if (!project) return <div className="skeleton mx-5 h-[70svh] rounded-2xl sm:mx-10" aria-label="A minta betöltése" />;
  return (
    <StoryContext.Provider value={{ project, projectId: project.id, editing: false, standalone: true }}>
      <Story />
    </StoryContext.Provider>
  );
}
