import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../model/store';
import { Modal } from '../app/Modal';
import { AI_MAX_EDGE, candidatePhotos, enhanceAvailability, enhanceChapter, EnhanceError } from './enhanceClient';
import { IconCheck, IconShield, IconSparkles } from '../lib/icons';
import { IS_ARTIFACT } from '../lib/runtime';

type Status = 'idle' | 'running' | 'done' | 'error';

/**
 * AI-szépítés: előbb pontosan megmutatja, mi megy ki a szerverre, és csak a
 * user kifejezett kérésére küld. A user által átírt címeket/szövegeket nem
 * írja felül. Minden lépés visszavonható.
 */
export function EnhancePanel({ onClose }: { onClose(): void }) {
  const project = useStore((s) => s.project)!;
  const [status, setStatus] = useState<Status>('idle');
  const [done, setDone] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [fatal, setFatal] = useState('');
  const abort = useRef<AbortController | null>(null);
  const [availability, setAvailability] = useState<'checking' | 'ok' | 'not_configured' | 'unavailable'>('checking');

  useEffect(() => {
    enhanceAvailability().then(setAvailability);
  }, []);

  const plan = useMemo(() => project.chapters.map((c) => ({ c, ids: candidatePhotos(project, c) })).filter((x) => x.ids.length), [project]);
  const photoCount = plan.reduce((n, x) => n + x.ids.length, 0);

  const run = async () => {
    setStatus('running');
    setDone(0);
    setErrors([]);
    setFatal('');
    abort.current = new AbortController();
    const queue = [...plan];
    const errs: string[] = [];
    let stop = false;

    const worker = async () => {
      while (queue.length && !stop) {
        const { c } = queue.shift()!;
        try {
          const latest = useStore.getState().project!;
          const chapter = latest.chapters.find((x) => x.id === c.id);
          if (!chapter) continue;
          const r = await enhanceChapter(latest, chapter, abort.current!.signal);
          const st = useStore.getState();
          const now = st.project!.chapters.find((x) => x.id === c.id)!;
          st.updateChapter(c.id, {
            ...(now.titleSource !== 'user' ? { title: r.title, titleSource: 'ai' as const } : {}),
            ...(now.summarySource !== 'user' ? { summary: r.summary, summarySource: 'ai' as const } : {}),
          });
          if (r.bestPhotoId) st.setHero(c.id, r.bestPhotoId);
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
          if (e instanceof EnhanceError && ['not_configured', 'network', 'auth', '404'].includes(e.code)) {
            stop = true;
            setFatal(e.code === '404' ? 'Ezen a telepítésen nincs AI-végpont.' : e.message);
            return;
          }
          errs.push(`${c.title}: ${(e as Error).message}`);
        } finally {
          setDone((d) => d + 1);
        }
      }
    };
    await Promise.all(IS_ARTIFACT ? [worker(), worker()] : [worker(), worker(), worker()]);
    setErrors(errs);
    setStatus(stop ? 'error' : 'done');
  };

  return (
    <Modal
      title="AI-szépítés"
      onClose={() => {
        abort.current?.abort();
        onClose();
      }}
    >
      <p className="text-muted">
        A Claude (Anthropic) megnézi fejezetenként a legjobb képeket, és ír hozzájuk egy címet meg egy-két mondatot, valamint javaslatot tesz a kiemelt képre.
        Utána mindent átírhatsz vagy visszavonhatsz.
      </p>

      <div className="mt-5 rounded-xl border border-line p-4 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <IconShield className="text-accent" /> Ami a szerverre megy
        </p>
        <ul className="mt-2 space-y-1 text-muted">
          <li>
            • <span className="text-ink">{photoCount} kép</span> {plan.length} fejezetből, legfeljebb {AI_MAX_EDGE} px-es, újratömörített másolatban
          </li>
          <li>• a fejezetek dátuma, helyneve és jelenlegi címe</li>
        </ul>
        <p className="mt-3 font-medium">Ami nem megy ki</p>
        <ul className="mt-1 space-y-1 text-muted">
          <li>• az eredeti fájlok, a fájlnevek, az EXIF-adatok és a pontos GPS-koordináták</li>
          <li>• a többi kép</li>
        </ul>
        <p className="mt-3 text-xs text-muted">
          {IS_ARTIFACT
            ? 'Ebben az előnézetben a képeket a saját Claude-fiókod dolgozza fel (a claude.ai előbb engedélyt kér), a használat a saját keretedből megy. Nincs API-kulcs és nincs saját szerver.'
            : 'A szerver csak továbbítja a kérést az Anthropic API-nak, nem tárol és nem naplóz képet.'}
        </p>
      </div>

      {availability === 'not_configured' && (
        <p role="alert" className="mt-4 rounded-lg bg-accent/10 px-4 py-3 text-sm">
          Ezen a telepítésen nincs beállítva AI-kulcs, ezért nem küldünk semmit. Az algoritmikus címek és válogatás így is működnek.
        </p>
      )}
      {availability === 'unavailable' && (
        <p role="alert" className="mt-4 rounded-lg bg-accent/10 px-4 py-3 text-sm">
          {IS_ARTIFACT
            ? 'Ebben a nézetben nem érhető el a Claude (nyisd meg az oldalt bejelentkezve a claude.ai-ban).'
            : 'Az AI-szolgáltatás most nem érhető el (nincs hálózat, vagy ez a telepítés nem tartalmaz AI-végpontot).'}
        </p>
      )}
      {fatal && (
        <p role="alert" className="mt-4 rounded-lg bg-accent/10 px-4 py-3 text-sm">
          {fatal} Az algoritmikus címek és válogatás változatlanul megmaradnak.
        </p>
      )}

      {status === 'running' && (
        <div className="mt-5" aria-live="polite">
          <div className="h-1.5 overflow-hidden rounded-full bg-soft">
            <div className="h-full bg-accent transition-all" style={{ width: `${(done / plan.length) * 100}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted">
            {done} / {plan.length} fejezet…
          </p>
        </div>
      )}

      {status === 'done' && (
        <div className="mt-5 rounded-xl bg-soft p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <IconCheck className="text-accent" /> Kész. A szerkesztőben bármit átírhatsz, a Vissza gomb visszavonja.
          </p>
          {errors.length > 0 && <p className="mt-2 text-muted">{errors.length} fejezetnél nem sikerült, ott maradt az eredeti szöveg.</p>}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        {status === 'done' ? (
          <button onClick={onClose} className="flex-1 rounded-full bg-accent px-6 py-4 font-semibold text-accent-ink">
            Megnézem
          </button>
        ) : (
          <button
            onClick={run}
            disabled={status === 'running' || !plan.length || availability !== 'ok'}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-accent px-6 py-4 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-50"
          >
            <IconSparkles /> {status === 'running' ? 'Dolgozik…' : availability === 'checking' ? 'Ellenőrzés…' : 'Rendben, mehet'}
          </button>
        )}
      </div>
    </Modal>
  );
}
