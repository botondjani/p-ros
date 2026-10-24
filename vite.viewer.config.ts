import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * A MapLibre worker-fájl bemásolása fix néven, és files.json: az export
 * ebből tudja, mely fájlokat kell a zip-be tenni.
 */
function fileList(): Plugin {
  return {
    name: 'viewer-file-list',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'assets/maplibre-gl-worker.mjs',
        source: readFileSync(resolve(__dirname, 'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs')),
      });
    },
    writeBundle(options, bundle) {
      const files = Object.keys(bundle).filter((f) => f !== 'files.json').sort();
      writeFileSync(resolve(options.dir!, 'files.json'), JSON.stringify(files));
    },
  };
}

// Az exportált, önálló oldal futtatókódja. Klasszikus (IIFE) scriptként
// fordul, mert a böngészők file:// alól nem töltenek be ES modult. Fix
// fájlnevekkel a public/viewer mappába kerül, ahonnan az export másolja.
export default defineConfig({
  plugins: [react(), tailwindcss(), fileList()],
  base: './',
  publicDir: false,
  resolve: {
    alias: [{ find: /^\.\/mapWorker$/, replacement: resolve(__dirname, 'src/viewer/mapWorker.ts') }],
  },
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'public/viewer',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: resolve(__dirname, 'src/viewer/main.tsx'),
      // A MapLibre saját worker-keresője import.meta-t használ; mi explicit URL-t adunk (mapWorker.ts).
      onLog(level, log, handler) {
        if (log.code === 'EMPTY_IMPORT_META') return;
        handler(level, log);
      },
      output: {
        format: 'iife',
        entryFileNames: 'viewer.js',
        assetFileNames: (info) => (info.names?.some((n) => n.endsWith('.css')) ? 'viewer.css' : 'assets/[name][extname]'),
      },
    },
  },
});
