import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  // a libheif wasm-csomag nagy és önálló; ne optimalizálja előre a dev szerver
  optimizeDeps: { exclude: ['libheif-js'] },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
