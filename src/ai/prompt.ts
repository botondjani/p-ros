// Az AI-szépítés promptja: a Vercel-függvény (server/enhance.ts) és az
// Artifact-előnézet (src/ai/enhanceClient.ts) is ezt használja.

export interface PromptChapter {
  when: string;
  place?: string;
  currentTitle?: string;
}

export interface PromptInput {
  projectTitle?: string;
  chapter: PromptChapter;
  photoIds: string[];
  otherChapters: { when: string; place?: string; title?: string }[];
}

export const SYSTEM_PROMPT = `Egy személyes, ajándékba szánt fotós visszatekintő („Időkapszula”) fejezeteihez írsz szöveget. Valaki a közös út vagy év képeiből készít emléket egy hozzá közel álló embernek (pár, barát, család).

Feladatod egy fejezethez:
- title: rövid, magyar fejezetcím, legfeljebb 5 szó. Lehet benne a hely neve, de nem kötelező; legyen konkrét és személyes hangulatú, mint egy fényképalbum lapján.
- summary: 1–2 mondat magyarul, amely a képeken látható pillanatot idézi fel, mintha a „mi” emlékeznénk vissza. Múlt idő, természetes, meleg hangnem.
- bestPhotoId: annak a képnek az azonosítója, amely legjobban összefoglalja a fejezetet (éles, jól komponált, jellegzetes).

Stílus:
- Kerüld a közhelyeket és a túlzásokat (pl. „felejthetetlen”, „varázslatos”, „csodálatos”, „életre szóló élmény”), az emojit és a felkiáltójelet.
- Csak arra hivatkozz, ami a képeken vagy a megadott adatokban (dátum, helynév) valóban látszik; ne találj ki eseményeket, neveket vagy kapcsolatokat.
- Embereket ne azonosíts és ne írd le a külsejüket.
- A cím ne ismételje a többi fejezet címét.`;

/** A fejezet adatai szövegként (a képek mellé). */
export function chapterContext(input: PromptInput): string {
  const { chapter } = input;
  return [
    input.projectTitle ? `Az egész emlék címe: ${input.projectTitle}` : '',
    `Ez a fejezet: ${chapter.when}${chapter.place ? `, ${chapter.place}` : ''}.`,
    chapter.currentTitle ? `Jelenlegi (automatikus) cím: ${chapter.currentTitle}` : '',
    input.otherChapters.length
      ? `A többi fejezet: ${input.otherChapters.map((c) => [c.title, c.when, c.place].filter(Boolean).join(' – ')).join('; ')}`
      : '',
    `A képek azonosítói sorrendben: ${input.photoIds.join(', ')}. A bestPhotoId ezek egyike legyen.`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Egyetlen szöveges prompt (ahol nincs külön rendszerprompt, pl. az Artifactban). */
export function singlePrompt(input: PromptInput): string {
  return `${SYSTEM_PROMPT}

A képek a megadott azonosítók sorrendjében érkeznek (az első kép az első azonosító, és így tovább).

${chapterContext(input)}

Válaszolj kizárólag egy JSON objektummal, más szöveg nélkül:
{"title": "…", "summary": "…", "bestPhotoId": "…"}`;
}
