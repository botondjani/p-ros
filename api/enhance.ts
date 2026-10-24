import type { VercelRequest, VercelResponse } from '@vercel/node';
import { enhanceStatus, handleEnhance } from '../server/enhance';

// Vercel serverless függvény: POST /api/enhance. A kulcs csak a szerveren,
// környezeti változóban van (ANTHROPIC_API_KEY), sosem a kliensben.
export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowed = process.env.ALLOWED_ORIGIN;
  if (allowed && req.headers.origin && req.headers.origin !== allowed) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    const { status, json } = enhanceStatus();
    res.status(status).json(json);
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  const { status, json } = await handleEnhance(req.body);
  res.status(status).json(json);
}
