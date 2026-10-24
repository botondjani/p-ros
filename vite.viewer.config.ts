import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

// Az exportált, önálló oldal futtatókódja. Fix fájlnevekkel a public/viewer
// mappába fordul, ahonnan az export a zip-be másolja.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  publicDir: false,
  build: {
    outDir: 'public/viewer',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: resolve(__dirname, 'src/viewer/main.tsx'),
      output: {
        entryFileNames: 'viewer.js',
        assetFileNames: (info) =>
          info.names?.some((n) => n.endsWith('.css')) ? 'viewer.css' : 'assets/[name][extname]',
        inlineDynamicImports: true,
      },
    },
  },
});
