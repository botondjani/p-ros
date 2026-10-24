// Az exportált oldalon a worker a viewer.js melletti assets mappában van
// (lásd vite.viewer.config.ts), az URL-t futásidőben számoljuk.
export const mapWorkerUrl = (): string => new URL('assets/maplibre-gl-worker.mjs', document.baseURI).href;
