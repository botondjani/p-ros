// A MapLibre worker-fájl URL-je az alkalmazásban: a Vite másolja az assetek közé.
// Az exportált oldal saját változatot használ (src/viewer/mapWorker.ts).
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

export const mapWorkerUrl = (): string => workerUrl;
