import { afterEach, describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { enhanceChapter, EnhanceRefusedError, handleEnhance, type EnhanceRequest } from '../server/enhance';

const req: EnhanceRequest = {
  projectTitle: 'Portugália',
  chapter: { id: 'c1', when: 'Május 15., csütörtök', place: 'Sintra', photos: [{ id: 'a', data: 'AAAA' }, { id: 'b', data: 'BBBB' }] },
  otherChapters: [{ when: 'Május 14.', place: 'Lisszabon', title: 'Lisszabon' }],
};

function fakeClient(response: object) {
  const parse = vi.fn().mockResolvedValue(response);
  return { client: { beta: { messages: { parse } } } as unknown as Anthropic, parse };
}

describe('enhanceChapter', () => {
  it('a képeket base64 JPEG-ként, azonosítóval küldi, és visszaadja az eredményt', async () => {
    const { client, parse } = fakeClient({ stop_reason: 'end_turn', parsed_output: { title: ' Ködös reggel ', summary: 'A palota fölött.', bestPhotoId: 'b' } });
    const r = await enhanceChapter(req, client);
    expect(r).toEqual({ title: 'Ködös reggel', summary: 'A palota fölött.', bestPhotoId: 'b' });
    const params = parse.mock.calls[0][0];
    expect(params.model).toBe('claude-opus-5-5');
    const images = params.messages[0].content.filter((b: { type: string }) => b.type === 'image');
    expect(images).toHaveLength(2);
    expect(images[0].source).toEqual({ type: 'base64', media_type: 'image/jpeg', data: 'AAAA' });
  });

  it('ismeretlen képazonosító helyett az elsőt adja', async () => {
    const { client } = fakeClient({ stop_reason: 'end_turn', parsed_output: { title: 'x', summary: 'y', bestPhotoId: 'nincs-ilyen' } });
    expect((await enhanceChapter(req, client)).bestPhotoId).toBe('a');
  });

  it('elutasításnál külön hibát dob', async () => {
    const { client } = fakeClient({ stop_reason: 'refusal', stop_details: { category: null }, parsed_output: null });
    await expect(enhanceChapter(req, client)).rejects.toBeInstanceOf(EnhanceRefusedError);
  });
});

describe('handleEnhance', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('kulcs nélkül 501, hogy a kliens az algoritmikus módban maradjon', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    expect((await handleEnhance(req)).status).toBe(501);
  });

  it('érvénytelen vagy túl nagy kérésre 400', async () => {
    process.env.ANTHROPIC_API_KEY = 'test';
    expect((await handleEnhance({})).status).toBe(400);
    const tooMany = { ...req, chapter: { ...req.chapter, photos: Array.from({ length: 7 }, (_, i) => ({ id: `${i}`, data: 'A' })) } };
    expect((await handleEnhance(tooMany)).status).toBe(400);
  });
});

describe('enhanceStatus', () => {
  it('jelzi, hogy be van-e állítva a kulcs', async () => {
    const { enhanceStatus } = await import('../server/enhance');
    const saved = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'x';
    expect(enhanceStatus().json).toEqual({ configured: true });
    if (saved === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = saved;
  });
});
