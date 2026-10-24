import type { RawItem, Source } from '../model/types';
import { uid } from '../lib/id';
import { isAcceptedFile } from '../pipeline/ingest';

/** Helyi fájlok (drag & drop vagy fájlválasztó). A fájlok tartalma a böngészőben marad. */
export function fileSource(files: File[]): Source {
  const accepted = files.filter(isAcceptedFile);
  const id = uid('src_');
  return {
    id,
    kind: 'files',
    label: `${accepted.length} fájl`,
    count: accepted.length,
    async *items(): AsyncIterable<RawItem> {
      for (const f of accepted) {
        yield { id: uid('ph_'), name: f.name, blob: f, lastModified: f.lastModified || undefined };
      }
    },
  };
}

/** Mappák és fájlok bejárása egy drop eseményből (Chrome/Safari/Firefox: webkitGetAsEntry). */
export async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const entries: FileSystemEntry[] = [];
  const loose: File[] = [];
  for (const item of Array.from(dt.items)) {
    if (item.kind !== 'file') continue;
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
    else {
      const f = item.getAsFile();
      if (f) loose.push(f);
    }
  }
  if (!entries.length) return loose.length ? loose : Array.from(dt.files);

  const out: File[] = [...loose];
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      const f = await new Promise<File | null>((res) => (entry as FileSystemFileEntry).file(res, () => res(null)));
      if (f) out.push(f);
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // readEntries kötegekben ad vissza, üres tömbig kell hívni
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res) => reader.readEntries(res, () => res([])));
        if (!batch.length) break;
        await Promise.all(batch.map(walk));
      }
    }
  };
  await Promise.all(entries.map(walk));
  return out;
}
