import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useStore } from '../model/store';
import { openSaved, startDemo, startFiles } from './flow';
import { IconCamera, IconPin, IconShield, IconUpload } from '../lib/icons';

const DemoPreview = lazy(() => import('./DemoPreview'));
const prefetchDemo = () => import('./DemoPreview');

/**
 * A minta csak az első görgetés/érintés után töltődik be, és csak ha közel
 * van a látómezőhöz: így az első betöltés gyors marad (a térkép kódja nagy).
 */
function useNearViewport<T extends HTMLElement>(margin = '600px') {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    let io: IntersectionObserver | undefined;
    const start = () => {
      window.removeEventListener('scroll', start);
      window.removeEventListener('pointerdown', start);
      prefetchDemo();
      if (typeof IntersectionObserver === 'undefined') return setNear(true);
      io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setNear(true), { rootMargin: `${margin} 0px` });
      io.observe(el);
    };
    // a „Nézd meg a példát” linkre kattintás is görgetés, így az is elindítja
    window.addEventListener('scroll', start, { passive: true, once: true });
    window.addEventListener('pointerdown', start, { passive: true, once: true });
    return () => {
      window.removeEventListener('scroll', start);
      window.removeEventListener('pointerdown', start);
      io?.disconnect();
    };
  }, [near, margin]);
  return { ref, near };
}

const FEATURES = [
  { icon: IconCamera, title: 'Kiválogatja a legjobbakat', text: 'Kiszűri a bemozdult, sötét és ismétlődő képeket, és fejezetenként a legszebbeket teszi előre.' },
  { icon: IconPin, title: 'Idővonal és térkép', text: 'Napokra és helyekre bontja a képeket, a térkép pedig végigrepül az útvonalon.' },
  { icon: IconShield, title: 'A képeid nálad maradnak', text: 'Minden a böngésződben történik. Nincs regisztráció, nincs feltöltés.' },
];

export function Landing() {
  const input = useRef<HTMLInputElement>(null);
  const saved = useStore((s) => s.savedProject);
  const error = useStore((s) => s.error);
  const demo = useNearViewport<HTMLDivElement>();
  const pick = () => input.current?.click();

  return (
    <main className="grain min-h-svh">
      <div className="mx-auto flex max-w-6xl flex-col px-5 pb-10 pt-6 sm:px-10 lg:min-h-svh">
        <nav className="flex items-center justify-between">
          <span className="font-display text-xl font-[500] tracking-tight">Időkapszula</span>
          {saved && (
            <button onClick={openSaved} className="rounded-full border border-line px-4 py-2 text-sm hover:border-ink">
              Folytatás: <span className="font-medium">{saved.title}</span>
            </button>
          )}
        </nav>

        <section className="grid flex-1 items-center gap-10 pb-4 pt-10 lg:grid-cols-[1.15fr_1fr] lg:gap-12 lg:py-0">
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
                onClick={pick}
                className="flex items-center justify-center gap-2 rounded-full bg-accent px-7 py-4 text-base font-semibold text-accent-ink shadow-[0_10px_30px_-12px_var(--c-accent)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-12px_var(--c-accent)] active:translate-y-0"
              >
                <IconUpload /> Válaszd ki a fotóidat
              </button>
              <a
                href="#minta"
                className="flex items-center justify-center gap-2 rounded-full border border-ink/20 px-6 py-4 text-base font-medium transition hover:border-ink"
              >
                Nézd meg a példát ↓
              </a>
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
      </div>

      <div id="minta" ref={demo.ref} className="scroll-mt-4 border-t border-line pt-14">
        <div className="mx-auto max-w-6xl px-5 sm:px-10">
          <p className="eyebrow">Így néz ki</p>
          <p className="font-display mt-3 max-w-2xl text-2xl font-[380] leading-snug sm:text-3xl">
            Egy négynapos portugáliai út 32 fotóból. Görgess tovább – pontosan ilyet kapsz a saját képeidből.
          </p>
        </div>
        {demo.near && (
          <Suspense fallback={<div className="skeleton mx-5 mt-10 h-[70svh] rounded-2xl sm:mx-10" />}>
            <DemoPreview />
          </Suspense>
        )}
      </div>

      <div className="mx-auto max-w-6xl px-5 pb-4 pt-16 sm:px-10">
        <section className="grid gap-8 sm:grid-cols-3" aria-label="Hogyan működik">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title}>
              <Icon className="mb-3 text-accent" width={22} height={22} />
              <h2 className="font-display text-xl font-[450]">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </section>
      </div>

      <section className="border-t border-line px-5 py-20 text-center sm:px-10" aria-label="Kezdd el">
        <h2 className="font-display text-[clamp(2rem,6vw,3.4rem)] font-[350] leading-tight">Most a te képeiden.</h2>
        <p className="mx-auto mt-4 max-w-md text-muted">A képeid nem hagyják el a telefonodat vagy a gépedet. Regisztráció sincs.</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button onClick={pick} className="flex w-full max-w-xs items-center justify-center gap-2 rounded-full bg-accent px-7 py-4 font-semibold text-accent-ink sm:w-auto">
            <IconUpload /> Válaszd ki a fotóidat
          </button>
          <button onClick={startDemo} className="w-full max-w-xs rounded-full border border-ink/20 px-6 py-4 font-medium hover:border-ink sm:w-auto">
            Próbáld ki a szerkesztőt a mintán
          </button>
        </div>
      </section>
    </main>
  );
}

/** „Nyomatköteg” két valódi mintaképpel (kicsi, ~50 KB) és egy rajzolt útvonallal. */
function LandingArt() {
  const thumb = (f: string) => `${import.meta.env.BASE_URL}demo/thumbs/${f}.webp`;
  return (
    <div className="relative mx-auto aspect-[5/6] w-full max-w-[340px] sm:max-w-[400px] lg:max-w-[440px]" aria-hidden>
      <div className="print absolute left-[4%] top-[10%] w-[52%] p-2.5 pb-10 sm:p-3 sm:pb-12" style={{ animation: 'float-a 9s ease-in-out infinite' }}>
        <img src={thumb('s05')} alt="" width={320} height={480} decoding="async" className="aspect-[4/5] w-full object-cover" />
        <p className="font-display absolute bottom-2.5 left-3.5 text-sm italic text-muted sm:bottom-3 sm:left-4">május 15. · Sintra</p>
      </div>
      <div className="print absolute right-[2%] top-[0%] w-[48%] p-2.5 pb-10 sm:p-3 sm:pb-12" style={{ animation: 'float-b 11s ease-in-out infinite' }}>
        <img src={thumb('p06')} alt="" width={480} height={320} decoding="async" className="aspect-square w-full object-cover" />
        <p className="font-display absolute bottom-2.5 left-3.5 text-sm italic text-muted sm:bottom-3 sm:left-4">Porto</p>
      </div>
      <div className="print absolute bottom-[2%] left-[22%] w-[60%] p-2.5 pb-10 sm:p-3 sm:pb-12" style={{ animation: 'float-c 10s ease-in-out infinite' }}>
        <div className="relative aspect-[4/3] overflow-hidden bg-[linear-gradient(170deg,#e9dcc6_0%,#d8c7a7_100%)]">
          <svg viewBox="0 0 200 150" className="absolute inset-0 h-full w-full">
            <path d="M40 125 C 70 110, 60 70, 95 60 S 150 40, 165 22" fill="none" stroke="#b5532f" strokeWidth="2.5" strokeDasharray="5 6" />
            <circle cx="40" cy="125" r="5" fill="#b5532f" />
            <circle cx="165" cy="22" r="5" fill="#2b2420" />
          </svg>
        </div>
        <p className="font-display absolute bottom-2.5 left-3.5 text-sm italic text-muted sm:bottom-3 sm:left-4">306 km</p>
      </div>
    </div>
  );
}
