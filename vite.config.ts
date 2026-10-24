import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  // nagy, önálló (wasm/worker) csomagok: a dev szerver ne optimalizálja őket előre
  optimizeDeps: { exclude: ['libheif-js', 'maplibre-gl'] },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
