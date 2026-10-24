import { useEffect } from 'react';
import { useStore } from '../model/store';
import { THEMES } from '../app/themes';
import { IconCheck, IconPalette, IconRefresh } from '../lib/icons';

/** Szerkesztő módban alul megjelenő sáv: téma választása és kilépés. */
export function EditorBar() {
  const theme = useStore((s) => s.project?.theme);
  const setTheme = useStore((s) => s.setTheme);
  const setEditing = useStore((s) => s.setEditing);
  const undo = useStore((s) => s.undo);
  const canUndo = useStore((s) => s.canUndo);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.('input, textarea');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && !typing) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <IconPalette className="hidden text-muted sm:block" />
          <span className="hidden text-sm text-muted sm:inline">Téma</span>
          <div className="flex gap-1.5" role="radiogroup" aria-label="Téma">
            {THEMES.map((t) => (
              <button
                key={t.id}
                role="radio"
                aria-checked={theme === t.id}
                onClick={() => setTheme(t.id)}
                title={t.label}
                className={`flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-xs font-medium transition ${
                  theme === t.id ? 'border-ink' : 'border-line hover:border-muted'
                }`}
              >
                <span className="flex h-5 w-5 overflow-hidden rounded-full border border-black/10">
                  <span className="w-1/2" style={{ background: t.swatch[0] }} />
                  <span className="w-1/2" style={{ background: t.swatch[2] }} />
                </span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
        <p className="hidden text-xs text-muted lg:block">Kattints bármelyik szövegre az átíráshoz · minden automatikusan mentődik ezen a gépen</p>
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm hover:bg-ink/5 disabled:opacity-30"
            title="Visszavonás (Ctrl+Z)"
          >
            <IconRefresh className="-scale-x-100" /> <span className="hidden sm:inline">Vissza</span>
          </button>
          <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-bg">
            <IconCheck /> Kész
          </button>
        </div>
      </div>
    </div>
  );
}
