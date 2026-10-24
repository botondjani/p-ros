import { useEffect, useState } from 'react';
import { useStore } from '../model/store';
import { resetAll } from './flow';
import { IconCheck, IconDownload, IconEdit, IconPlus, IconSparkles } from '../lib/icons';

interface Props {
  onExport(): void;
  onEnhance(): void;
}

function Btn({ onClick, children, label, primary }: { onClick(): void; children: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition sm:px-4 ${
        primary ? 'bg-accent text-accent-ink hover:brightness-110' : 'hover:bg-ink/5'
      }`}
    >
      {children}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

export function TopBar({ onExport, onEnhance }: Props) {
  const editing = useStore((s) => s.editing);
  const setEditing = useStore((s) => s.setEditing);
  const isDemo = useStore((s) => s.project?.isDemo);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-500 ${
        scrolled || editing ? 'border-b border-line bg-bg/85 backdrop-blur-md' : 'border-b border-transparent'
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-6">
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="font-display px-2 text-lg font-[500] tracking-tight">
          Időkapszula
          {isDemo && <span className="eyebrow ml-2 align-middle !text-[0.6rem]">minta</span>}
        </button>
        <div className="flex items-center gap-0.5 sm:gap-1">
          <Btn
            onClick={() => {
              if (confirm('Új projektet kezdesz? A mostani törlődik erről a gépről (ha kell, előbb töltsd le).')) resetAll();
            }}
            label="Új"
          >
            <IconPlus />
          </Btn>
          <Btn onClick={onEnhance} label="AI-szépítés">
            <IconSparkles />
          </Btn>
          <Btn onClick={() => setEditing(!editing)} label={editing ? 'Kész' : 'Szerkesztés'}>
            {editing ? <IconCheck /> : <IconEdit />}
          </Btn>
          <Btn onClick={onExport} label="Letöltés" primary>
            <IconDownload />
          </Btn>
        </div>
      </div>
    </div>
  );
}
