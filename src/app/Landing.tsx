import { useRef } from 'react';
import { useStore } from '../model/store';
import { openSaved, startDemo, startFiles } from './flow';
import { IconCamera, IconPin, IconShield, IconUpload } from '../lib/icons';

const FEATURES = [
  { icon: IconCamera, title: 'Kiválogatja a legjobbakat', text: 'Kiszűri a bemozdult, sötét és ismétlődő képeket, és fejezetenként a legszebbeket teszi előre.' },
  { icon: IconPin, title: 'Idővonal és térkép', text: 'Napokra és helyekre bontja a képeket, a térkép pedig végigrepül az útvonalon.' },
  { icon: IconShield, title: 'A képeid nálad maradnak', text: 'Minden a böngésződben történik. Nincs regisztráció, nincs feltöltés.' },
];

export function Landing() {
  const input = useRef<HTMLInputElement>(null);
  const saved = useStore((s) => s.savedProject);
  const error = useStore((s) => s.error);

  return (
    <main className="grain min-h-svh">
      <div className="mx-auto flex min-h-svh max-w-6xl flex-col px-5 pb-10 pt-6 sm:px-10">
        <nav className="flex items-center justify-between">
          <span className="font-display text-xl font-[500] tracking-tight">Időkapszula</span>
          {saved && (
            <button onClick={openSaved} className="rounded-full border border-line px-4 py-2 text-sm hover:border-ink">
              Folytatás: <span className="font-medium">{saved.title}</span>
            </button>
          )}
        </nav>

        <section className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[1.15fr_1fr] lg:py-0">
          <div>
            <p className="eyebrow mb-6">Ajándék, ami a fotóidból készül</p>
            <h1 className="font-display text-[clamp(2.8rem,7.5vw,6rem)] font-[340] leading-[0.98] tracking-[-0.02em]">
              Egy közös év,
              <br />
              <em className="font-[300] text-accent">húsz másodperc</em> alatt.
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-relaxed text-muted">
              Húzd ide a képeidet, és kapsz egy szép, görgethető visszatekintőt: fejezetek, térkép, a legjobb pillanatok.
              Utána mindent átírhatsz, és elküldheted annak, akinek szól.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                onClick={startDemo}
                className="rounded-full bg-accent px-7 py-4 text-base font-semibold text-accent-ink shadow-[0_10px_30px_-12px_var(--c-accent)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-12px_var(--c-accent)] active:translate-y-0"
              >
                Próbáld ki mintaképekkel
              </button>
              <button
                onClick={() => input.current?.click()}
                className="flex items-center justify-center gap-2 rounded-full border border-ink/20 px-6 py-4 text-base font-medium transition hover:border-ink"
              >
                <IconUpload /> Saját képek kiválasztása
              </button>
              <input
                ref={input}
                type="file"
                multiple
                accept="image/*,.heic,.heif"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = '';
                  if (files.length) startFiles(files);
                }}
              />
            </div>
            <p className="mt-4 hidden text-sm text-muted sm:block">…vagy egyszerűen húzz ide egy mappát. 30–200 kép az ideális.</p>
            {error && (
              <p role="alert" className="mt-5 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
                {error}
              </p>
            )}
          </div>

          <LandingArt />
        </section>

        <section className="grid gap-8 border-t border-line pt-10 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title}>
              <Icon className="mb-3 text-accent" width={22} height={22} />
              <h2 className="font-display text-xl font-[450]">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

/** Dekoratív, kép nélküli „nyomatköteg” – gyors LCP, nincs hálózati kérés. */
function LandingArt() {
  return (
    <div className="relative mx-auto hidden aspect-[5/6] w-full max-w-[440px] lg:block" aria-hidden>
      <div className="print absolute left-[4%] top-[10%] w-[58%] p-3 pb-12" style={{ animation: 'float-a 9s ease-in-out infinite' }}>
        <div className="aspect-[4/5] bg-[linear-gradient(160deg,#f2c48d_0%,#e08b5b_45%,#7d4a5a_100%)]" />
        <p className="font-display absolute bottom-3 left-4 text-sm italic text-muted">május 15.</p>
      </div>
      <div className="print absolute right-[2%] top-[0%] w-[50%] p-3 pb-12" style={{ animation: 'float-b 11s ease-in-out infinite' }}>
        <div className="aspect-square bg-[linear-gradient(180deg,#9cc4d4_0%,#5e8fa8_55%,#2f4f5f_100%)]" />
        <p className="font-display absolute bottom-3 left-4 text-sm italic text-muted">Porto</p>
      </div>
      <div className="print absolute bottom-[2%] left-[24%] w-[60%] p-3 pb-12" style={{ animation: 'float-c 10s ease-in-out infinite' }}>
        <div className="relative aspect-[4/3] overflow-hidden bg-[linear-gradient(170deg,#e9dcc6_0%,#d8c7a7_100%)]">
          <svg viewBox="0 0 200 150" className="absolute inset-0 h-full w-full">
            <path d="M20 120 C 60 40, 110 130, 180 30" fill="none" stroke="#b5532f" strokeWidth="2.5" strokeDasharray="5 6" />
            <circle cx="20" cy="120" r="5" fill="#b5532f" />
            <circle cx="180" cy="30" r="5" fill="#2b2420" />
          </svg>
        </div>
        <p className="font-display absolute bottom-3 left-4 text-sm italic text-muted">274 km</p>
      </div>
    </div>
  );
}
