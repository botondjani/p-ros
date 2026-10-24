/**
 * Futtatókörnyezet: a normál webapp, vagy a claude.ai Artifact-előnézet
 * (`npm run build:artifact`). Az Artifactban a böngésző nem érhet el külső
 * szervert, viszont a claude.ai képességei (Claude, letöltés) elérhetők a
 * `window.claude.use()`-on át.
 */
export const IS_ARTIFACT = import.meta.env.VITE_TARGET === 'artifact';

export interface SampleFn {
  (input: string, options?: Record<string, unknown>): Promise<{ text: string; truncated: boolean }>;
  json<T = unknown>(input: string, options?: { images?: Blob[]; signal?: AbortSignal; modelTier?: 'quick' | 'default' | 'complex' }): Promise<T>;
  limits(): Promise<{ maxPromptBytes: number; images?: { maxCount: number; maxInputBytes: number; mediaTypes: string[] } }>;
}

export interface DownloadsApi {
  save(args: { filename: string; data: Blob }): Promise<unknown>;
}

interface ClaudeRuntime {
  use(name: string): Promise<unknown>;
}

/** Egy claude.ai képesség, vagy null, ha ez a nézet nem tudja futtatni. */
export async function useCapability<T>(name: 'sample' | 'downloads'): Promise<T | null> {
  const rt = (globalThis as { claude?: ClaudeRuntime }).claude;
  if (!IS_ARTIFACT || typeof rt?.use !== 'function') return null;
  try {
    return ((await rt.use(name)) as T | null) ?? null;
  } catch {
    return null;
  }
}
