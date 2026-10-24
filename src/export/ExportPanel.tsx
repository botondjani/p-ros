import { useState } from 'react';
import { useStore } from '../model/store';
import { Modal } from '../app/Modal';
import { buildZip, downloadBlob } from './buildZip';
import { IconDownload, IconLock } from '../lib/icons';

export function ExportPanel({ onClose }: { onClose(): void }) {
  const project = useStore((s) => s.project)!;
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const shown = Object.values(project.photos).filter((p) => p.included).length;

  const run = async () => {
    setError('');
    setDone(null);
    setProgress(0);
    try {
      const { blob, fileName } = await buildZip(project, {
        password: usePassword ? password : undefined,
        onProgress: (d, t) => setProgress(Math.round((d / t) * 100)),
      });
      downloadBlob(blob, fileName);
      setDone(`${fileName} · ${(blob.size / 1024 / 1024).toFixed(1)} MB`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  };

  return (
    <Modal title="Letöltés önálló oldalként" onClose={onClose}>
      <p className="text-muted">
        Egy zip-fájlt kapsz, benne egy kész weboldallal: <span className="text-ink">{shown} kép</span> kicsinyítve, a szövegeid és a térkép. Bárhová
        feltöltheted, vagy egyszerűen megnyithatod.
      </p>
      <ul className="mt-4 space-y-1.5 text-sm text-muted">
        <li>• Csak a látható képek kerülnek bele, fájlnevek és képenkénti pontos GPS nélkül.</li>
        <li>• A zip a gépeden készül, semmi nem megy fel szerverre.</li>
      </ul>

      <label className="mt-6 flex cursor-pointer items-center gap-3 rounded-xl border border-line p-4">
        <input type="checkbox" checked={usePassword} onChange={(e) => setUsePassword(e.target.checked)} className="h-4 w-4 accent-[var(--c-accent)]" />
        <IconLock className="text-muted" />
        <span className="flex-1">
          <span className="font-medium">Jelszavas védelem</span>
          <span className="block text-xs text-muted">Egyszerű védelem a véletlen betekintés ellen – nem banki szintű titkosítás.</span>
        </span>
      </label>
      {usePassword && (
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="pl. az első randink helye"
          aria-label="Jelszó"
          className="mt-3 w-full rounded-xl border border-line bg-bg px-4 py-3 outline-none focus:border-accent"
        />
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-accent/10 px-4 py-3 text-sm">
          {error}
        </p>
      )}

      <button
        onClick={run}
        disabled={progress !== null || (usePassword && password.length < 4)}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-4 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-50"
      >
        <IconDownload />
        {progress !== null ? `Készül… ${progress}%` : 'ZIP letöltése'}
      </button>
      {usePassword && password.length > 0 && password.length < 4 && <p className="mt-2 text-center text-xs text-muted">Legalább 4 karakter legyen.</p>}

      {done && (
        <div className="mt-6 rounded-xl bg-soft p-4 text-sm">
          <p className="font-medium">Kész: {done}</p>
          <p className="mt-2 text-muted">
            Megosztáshoz csomagold ki, és húzd a mappát az{' '}
            <a href="https://app.netlify.com/drop" target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
              app.netlify.com/drop
            </a>{' '}
            oldalra – pár másodperc múlva kapsz egy linket.
          </p>
        </div>
      )}
    </Modal>
  );
}
