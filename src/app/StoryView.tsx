import { useState } from 'react';
import { useStore } from '../model/store';
import { TopBar } from './TopBar';
import { SummaryToast } from './SummaryToast';
import { EditorBar } from '../editor/EditorBar';
import { Story } from '../story/Story';
import { StoryContext } from '../story/context';
import { ExportPanel } from '../export/ExportPanel';
import { EnhancePanel } from '../ai/EnhancePanel';

/** A kész történet nézete a szerkesztővel, exporttal és AI-val. Lustán töltődik, hogy a landing gyors legyen. */
export default function StoryView() {
  const project = useStore((s) => s.project);
  const editing = useStore((s) => s.editing);
  const [panel, setPanel] = useState<'export' | 'enhance' | null>(null);
  if (!project) return null;

  return (
    <StoryContext.Provider value={{ project, projectId: project.id, editing, standalone: false }}>
      <TopBar onExport={() => setPanel('export')} onEnhance={() => setPanel('enhance')} />
      {editing ? <EditorBar /> : <SummaryToast />}
      <main className={editing ? 'pb-20' : ''}>
        <Story />
      </main>
      <footer className="px-5 pb-10 text-center text-xs text-muted">
        Készült az Időkapszulával · a képek nem hagyták el ezt a gépet
        {project.isDemo && <span className="mt-1 block">Mintaképek: Unsplash License · az időpontok és helyek illusztratívak</span>}
      </footer>
      {panel === 'export' && <ExportPanel onClose={() => setPanel(null)} />}
      {panel === 'enhance' && <EnhancePanel onClose={() => setPanel(null)} />}
    </StoryContext.Provider>
  );
}
