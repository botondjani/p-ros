import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

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

export default defineConfig({
  plugins: [react(), tailwindcss(), devApi()],
  worker: { format: 'es' },
  // nagy, önálló (wasm/worker) csomagok: a dev szerver ne optimalizálja őket előre
  optimizeDeps: { exclude: ['libheif-js', 'maplibre-gl'] },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
