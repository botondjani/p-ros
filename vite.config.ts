import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Fejlesztéshez: a /api/enhance végpont a Vite dev szerveren is fut (élesben
 * Vercel-függvény). A .env-ből olvassa a kulcsot, csak a szerver oldalon.
 */
function devApi(): Plugin {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''));
      server.middlewares.use('/api/enhance', async (req, res) => {
        const mod = (await server.ssrLoadModule('/server/enhance.ts')) as typeof import('./server/enhance');
        const send = ({ status, json }: { status: number; json: unknown }) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(json));
        };
        if (req.method === 'GET') return send(mod.enhanceStatus());
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        let body: unknown;
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
          body = undefined;
        }
        send(await mod.handleEnhance(body));
      });
    },
  };
}

/** A landing kritikus fontjainak előtöltése (a hash-elt fájlnevek csak build után ismertek). */
function preloadFonts(): Plugin {
  const critical = ['fraunces-latin.woff2', 'fraunces-latin-italic.woff2', 'fraunces-hu.woff2', 'fraunces-hu-italic.woff2', 'inter-latin.woff2', 'inter-hu.woff2'];
  let baseUrl = '/';
  return {
    name: 'preload-fonts',
    apply: 'build',
    configResolved(config) {
      baseUrl = config.base;
    },
    transformIndexHtml(html, ctx) {
      const base = ctx.server?.config.base ?? (ctx.bundle ? baseUrl : '/');
      const links = Object.values(ctx.bundle ?? {})
        .filter((a) => a.type === 'asset' && a.names?.some((n) => critical.includes(n)))
        .map((a) => ({ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '', href: `${base}${a.fileName}` }, injectTo: 'head' as const }));
      return { html, tags: links };
    },
  };
}

/**
 * Service worker az offline működéshez: az első látogatáskor előre letölti
 * az alkalmazás minden fájlját (worker, HEIC-dekóder, helynév-adatbázis is),
 * így utána hálózat nélkül is megy az elemzés és a megjelenítés. Képet,
 * API-hívást nem tárol.
 */
function serviceWorker(): Plugin {
  let base = '/';
  return {
    name: 'service-worker',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      // az export offline is menjen: a viewer fájljai (npm run build:viewer) is kellenek
      let viewer: string[] = [];
      try {
        viewer = ['files.json', ...JSON.parse(readFileSync(resolve(__dirname, 'public/viewer/files.json'), 'utf8'))].map((f) => `${base}viewer/${f}`);
      } catch {
        /* viewer nélkül is működik, csak az export kér hálózatot */
      }
      // a service worker a saját helyéhez képest oldja fel a relatív útvonalakat
      const assets = [base, `${base}places.json`, `${base}favicon.svg`, ...files.map((f) => `${base}${f}`), ...viewer];
      const version = createHash('sha256').update(files.sort().join('|')).digest('hex').slice(0, 12);
      const source = readFileSync(resolve(__dirname, 'src/sw.template.js'), 'utf8')
        .replace('__VERSION__', version)
        .replace('__ASSETS__', JSON.stringify(assets));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// `--mode pages`: GitHub Pages (alútvonal, ezért relatív útvonalak).
// `--mode artifact`: claude.ai Artifact-előnézet (relatív útvonalak, nincs service worker), lásd scripts/artifact-page.mjs
const OUT: Record<string, string> = { artifact: 'dist-artifact', pages: 'dist-pages' };
export default defineConfig(({ mode }) => ({
  base: OUT[mode] ? './' : '/',
  build: { outDir: OUT[mode] ?? 'dist' },
  plugins: [react(), tailwindcss(), devApi(), preloadFonts(), ...(mode === 'artifact' ? [] : [serviceWorker()])],
  worker: { format: 'es' },
  // nagy, önálló (wasm/worker) csomagok: a dev szerver ne optimalizálja őket előre
  optimizeDeps: { exclude: ['libheif-js', 'maplibre-gl'] },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));
