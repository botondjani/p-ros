import { useMemo, useState } from 'react';
import { useStore } from '../model/store';
import { Modal } from '../app/Modal';
import { buildZip, downloadBlob } from './buildZip';
import { buildSingleHtml, canShareFiles, shareFile } from './singleFile';
import { IconDownload, IconLock, IconShare } from '../lib/icons';
import { IS_ARTIFACT } from '../lib/runtime';

const mb = (b: Blob) => `${(b.size / 1024 / 1024).toFixed(1)} MB`;

/**
 * Megosztás szerver nélkül: egyetlen HTML-fájl, amit telefonon a rendszer
 * megosztás-menüjével (Messenger, WhatsApp, e-mail…), gépen letöltve lehet
 * elküldeni. A weboldal-csomag (zip) haladóknak megmarad.
 */
export function ExportPanel({ onClose }: { onClose(): void }) {
  const project = useStore((s) => s.project)!;
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const shown = Object.values(project.photos).filter((p) => p.included).length;
  const share = useMemo(() => !IS_ARTIFACT && canShareFiles(), []);
  const pw = usePassword ? password : undefined;
  const pwInvalid = usePassword && password.length < 4;

  const run = async (kind: 'file' | 'zip') => {
    setError('');
    setDone(null);
    setProgress(0);
    try {
      const onProgress = (d: number, t: number) => setProgress(Math.round((d / t) * 100));
      if (kind === 'zip') {
        const { blob, fileName } = await buildZip(project, { password: pw, onProgress });
        await downloadBlob(blob, fileName);
        setDone(`${fileName} letöltve (${mb(blob)}). Csomagold ki, és töltsd fel a mappát egy statikus tárhelyre.`);
        return;
      }
      const { blob, fileName } = await buildSingleHtml(project, { password: pw, onProgress });
      if (share) {
        const r = await shareFile(blob, fileName, project.title);
        if (r === 'shared') setDone(`Elküldve (${mb(blob)}).`);
      } else {
        await downloadBlob(blob, fileName);
        setDone(`${fileName} letöltve (${mb(blob)}). Csatold egy e-mailhez vagy üzenethez.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  };

  return (
    <Modal title="Megosztás" onClose={onClose}>
      <p className="text-muted">
        Egyetlen fájlt kapsz, benne a teljes emlékkel: <span className="text-ink">{shown} kép</span>, a szövegeid és az útvonal. Küldd el
        üzenetben vagy e-mailben; a címzett egy koppintással megnyitja.
      </p>

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
          id="share-password"
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
        onClick={() => run('file')}
        disabled={progress !== null || pwInvalid}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-4 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-50"
      >
        {share ? <IconShare /> : <IconDownload />}
        {progress !== null ? `Készül… ${progress}%` : share ? 'Megosztás…' : 'Fájl letöltése'}
      </button>
      {usePassword && password.length > 0 && pwInvalid && <p className="mt-2 text-center text-xs text-muted">Legalább 4 karakter legyen.</p>}

      {done && <p className="mt-4 rounded-xl bg-soft p-4 text-sm">{done}</p>}

      <p className="mt-5 text-xs leading-relaxed text-muted">
        A fájl ezen az eszközön készül, nem megy fel szerverre. Böngészőben megnyitva a teljes, görgethető oldal látszik; ha egy telefon csak
        előnézetben nyitja meg, akkor is látszanak a képek, a szövegek és az üzeneted.
        {usePassword && ' Jelszóval csak böngészőben nyitható meg.'}
      </p>

      <details className="mt-5 text-sm">
        <summary className="cursor-pointer text-muted hover:text-ink">Haladó: weboldal-csomag (zip) saját tárhelyre</summary>
        <p className="mt-2 text-muted">
          Ha saját weboldalként tennéd közzé (Netlify, GitHub Pages, saját szerver): csomagold ki, és töltsd fel a mappa tartalmát. Így a térkép
          is teljes értékű.
        </p>
        <button
          onClick={() => run('zip')}
          disabled={progress !== null || pwInvalid}
          className="mt-3 rounded-full border border-line px-4 py-2 font-medium hover:border-ink disabled:opacity-50"
        >
          ZIP letöltése
        </button>
      </details>
    </Modal>
  );
}
