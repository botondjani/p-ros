/**
 * Egyszerű, kliensoldali jelszavas titkosítás az exporthoz (PBKDF2 →
 * AES-GCM, WebCrypto). Véd a véletlen betekintés ellen, de nem erős
 * védelem: aki a fájlt megszerzi, offline próbálgathatja a jelszót.
 */
export interface EncryptedPayload {
  v: 1;
  iter: number;
  salt: string;
  iv: string;
  data: string;
}

const ITERATIONS = 250_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptText(plain: string, password: string): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITERATIONS);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain)));
  return { v: 1, iter: ITERATIONS, salt: toBase64(salt), iv: toBase64(iv), data: toBase64(data) };
}

/** Hibás jelszónál kivételt dob (az AES-GCM hitelesítés nem egyezik). */
export async function decryptText(payload: EncryptedPayload, password: string): Promise<string> {
  const key = await deriveKey(password, fromBase64(payload.salt), payload.iter);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(payload.iv) }, key, fromBase64(payload.data));
  return dec.decode(plain);
}
