import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { SYSTEM_PROMPT, chapterContext } from '../src/ai/prompt';

/**
 * AI-szépítés egy fejezetre: kis felbontású képekből (max 768 px) magyar
 * fejezetcím, 1–2 mondatos hangulatszöveg és a legjobb kép kiválasztása.
 * A képeket nem tároljuk és nem naplózzuk; csak továbbítjuk az Anthropic
 * API-nak, és a választ visszaadjuk.
 */

export const LIMITS = {
  maxPhotos: 6,
  maxImageBase64: 400_000, // ~300 KB-os JPEG
  maxContextChapters: 40,
  maxTextLength: 200,
};

const PhotoIn = z.object({ id: z.string().max(64), data: z.string().max(LIMITS.maxImageBase64) });
const ChapterIn = z.object({
  id: z.string().max(64),
  when: z.string().max(LIMITS.maxTextLength),
  place: z.string().max(LIMITS.maxTextLength).optional(),
  currentTitle: z.string().max(LIMITS.maxTextLength).optional(),
  photos: z.array(PhotoIn).min(1).max(LIMITS.maxPhotos),
});
export const EnhanceRequest = z.object({
  projectTitle: z.string().max(LIMITS.maxTextLength).optional(),
  chapter: ChapterIn,
  /** A többi fejezet rövid leírása, hogy a címek ne ismétlődjenek. */
  otherChapters: z
    .array(z.object({ when: z.string().max(LIMITS.maxTextLength), place: z.string().max(LIMITS.maxTextLength).optional(), title: z.string().max(LIMITS.maxTextLength).optional() }))
    .max(LIMITS.maxContextChapters)
    .default([]),
});
export type EnhanceRequest = z.infer<typeof EnhanceRequest>;

const EnhanceOutput = z.object({
  title: z.string().describe('Fejezetcím magyarul, legfeljebb 5 szó.'),
  summary: z.string().describe('1–2 mondatos, meleg hangulatszöveg magyarul.'),
  bestPhotoId: z.string().describe('A fejezetet legjobban megmutató kép azonosítója a megadottak közül.'),
});
export type EnhanceResult = z.infer<typeof EnhanceOutput>;



export class EnhanceRefusedError extends Error {}

export async function enhanceChapter(input: EnhanceRequest, client = new Anthropic()): Promise<EnhanceResult> {
  const { chapter } = input;
  const ids = chapter.photos.map((p) => p.id);

  const context = chapterContext({
    projectTitle: input.projectTitle,
    chapter,
    photoIds: ids,
    otherChapters: input.otherChapters,
  });

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const p of chapter.photos) {
    content.push({ type: 'text', text: `Kép: ${p.id}` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: p.data } });
  }
  content.push({ type: 'text', text: context });

  const response = await client.beta.messages.parse({
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-5-5',
    max_tokens: 16000,
    // Rövid, kreatív szöveg: alacsony effort elég, és gyorsabb.
    output_config: { effort: 'low', format: betaZodOutputFormat(EnhanceOutput) },
    // Biztonsági elutasításnál a szerver automatikusan másik modellen próbálja újra.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
  });

  if (response.stop_reason === 'refusal') throw new EnhanceRefusedError(response.stop_details?.category ?? 'refusal');
  const out = response.parsed_output;
  if (!out) throw new Error('A modell válasza nem értelmezhető.');
  return {
    title: out.title.trim().slice(0, 80),
    summary: out.summary.trim().slice(0, 400),
    bestPhotoId: ids.includes(out.bestPhotoId) ? out.bestPhotoId : ids[0],
  };
}

const configured = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

/** GET: be van-e állítva az AI. A kliens ezzel dönt, mielőtt bármilyen képet küldene. */
export function enhanceStatus(): { status: number; json: unknown } {
  return { status: 200, json: { configured: configured() } };
}

/** HTTP-független kezelő: a Vercel-függvény és a fejlesztői szerver is ezt hívja. */
export async function handleEnhance(body: unknown): Promise<{ status: number; json: unknown }> {
  if (!configured()) {
    return { status: 501, json: { error: 'not_configured', message: 'Az AI-szépítés nincs beállítva (ANTHROPIC_API_KEY).' } };
  }
  const parsed = EnhanceRequest.safeParse(body);
  if (!parsed.success) return { status: 400, json: { error: 'bad_request', message: 'Érvénytelen kérés.' } };
  try {
    return { status: 200, json: await enhanceChapter(parsed.data) };
  } catch (e) {
    if (e instanceof EnhanceRefusedError) return { status: 422, json: { error: 'refused', message: 'A modell ezt a fejezetet nem dolgozta fel.' } };
    if (e instanceof Anthropic.RateLimitError) return { status: 429, json: { error: 'rate_limited', message: 'Túl sok kérés, próbáld újra kicsit később.' } };
    if (e instanceof Anthropic.AuthenticationError) return { status: 500, json: { error: 'auth', message: 'Hibás API-kulcs a szerveren.' } };
    if (e instanceof Anthropic.APIError) return { status: 502, json: { error: 'upstream', message: `AI-szolgáltatás hiba (${e.status ?? '?'}).` } };
    return { status: 500, json: { error: 'internal', message: 'Váratlan hiba.' } };
  }
}
