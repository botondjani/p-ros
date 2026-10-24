// Helyőrző – a szerkesztő rács az (e) lépésben készül el.
import type { Chapter } from '../model/types';
export default function EditGrid({ chapter }: { chapter: Chapter }) {
  return <p className="text-muted">{chapter.photoIds.length} kép</p>;
}
