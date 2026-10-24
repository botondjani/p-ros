import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MlMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useStory } from './context';
import { themeById } from '../app/themes';
import { RouteSketch } from './RouteSketch';
import { mapWorkerUrl } from './mapWorker';
import type { Chapter } from '../model/types';

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const isDesktop = () => typeof matchMedia !== 'undefined' && matchMedia('(min-width: 1024px)').matches;

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function lineFeature(chapters: Chapter[]) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: chapters.filter((c) => c.location).map((c) => [c.location!.lng, c.location!.lat]) },
  };
}

/**
 * A fejezetek mellett ragadó térkép. Görgetéskor az aktív fejezet helyére
 * repül, és kirajzolja az addig megtett utat. Csak a térképcsempék jönnek
 * a hálózatról (OpenFreeMap); képek vagy koordináták nem mennek ki.
 */
export default function MapPanel({ activeChapterId }: { activeChapterId?: string }) {
  const { project } = useStory();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const theme = themeById(project.theme);

  const located = useMemo(() => project.chapters.filter((c) => c.location), [project.chapters]);
  const active = project.chapters.find((c) => c.id === activeChapterId);
  const activeIndex = project.chapters.findIndex((c) => c.id === activeChapterId);
  const locKey = located.map((c) => `${c.id}:${c.location!.lat.toFixed(4)},${c.location!.lng.toFixed(4)}`).join('|');

  // Térkép létrehozása (és újraépítése témaváltáskor).
  useEffect(() => {
    if (!container.current || !located.length) return;
    // file:// alól a böngésző nem indít workert, offline nincs csempe: ilyenkor a vázlat marad
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (!webglAvailable() || offline || location.protocol === 'file:') {
      setFailed(true);
      return;
    }
    setReady(false);
    setFailed(false);

    try {
      maplibregl.setWorkerUrl(mapWorkerUrl());
    } catch {
      /* a worker már fut – nem kell újra beállítani */
    }
    const bounds = new maplibregl.LngLatBounds();
    for (const c of located) bounds.extend([c.location!.lng, c.location!.lat]);
    let map: MlMap;
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: theme.mapStyle,
        bounds,
        fitBoundsOptions: { padding: 60, maxZoom: 11 },
        attributionControl: { compact: true },
        interactive: isDesktop(),
        scrollZoom: false,
        dragRotate: false,
        pitchWithRotate: false,
        fadeDuration: 150,
      });
    } catch {
      setFailed(true);
      return;
    }
    mapRef.current = map;
    const timeout = setTimeout(() => !map.loaded() && setFailed(true), 12000);

    map.on('error', (e) => {
      // a stílus vagy a csempék nem jönnek le (offline / blokkolva)
      if (!map.isStyleLoaded()) setFailed(true);
      console.warn('térkép:', e.error?.message);
    });

    map.on('load', () => {
      clearTimeout(timeout);
      const css = getComputedStyle(document.documentElement);
      const accent = css.getPropertyValue('--c-accent').trim() || '#b5532f';
      const muted = css.getPropertyValue('--c-muted').trim() || '#7a6d62';
      map.addSource('route-all', { type: 'geojson', data: lineFeature(located) });
      map.addSource('route-done', { type: 'geojson', data: lineFeature(located.slice(0, 1)) });
      map.addLayer({
        id: 'route-all',
        type: 'line',
        source: 'route-all',
        paint: { 'line-color': muted, 'line-width': 2, 'line-opacity': 0.55, 'line-dasharray': [1.5, 2] },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });
      map.addLayer({
        id: 'route-done',
        type: 'line',
        source: 'route-done',
        paint: { 'line-color': accent, 'line-width': 3.5 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      for (const c of located) {
        const el = document.createElement('button');
        el.className = 'ik-marker';
        el.textContent = String(project.chapters.indexOf(c) + 1);
        el.title = c.location?.name ?? c.title;
        el.setAttribute('aria-label', `Ugrás: ${el.title}`);
        el.addEventListener('click', () => document.querySelector(`[data-chapter-id="${c.id}"]`)?.scrollIntoView({ behavior: 'smooth' }));
        markers.current.set(c.id, new maplibregl.Marker({ element: el }).setLngLat([c.location!.lng, c.location!.lat]).addTo(map));
      }
      setReady(true);
    });

    return () => {
      clearTimeout(timeout);
      for (const m of markers.current.values()) m.remove();
      markers.current.clear();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme.mapStyle, locKey]);

  // Repülés az aktív fejezethez + megtett út frissítése.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const doneUpTo = project.chapters.slice(0, Math.max(0, activeIndex) + 1).filter((c) => c.location);
    (map.getSource('route-done') as GeoJSONSource | undefined)?.setData(lineFeature(doneUpTo.length ? doneUpTo : located.slice(0, 1)));
    for (const [id, m] of markers.current) {
      const el = m.getElement();
      el.dataset.active = String(id === activeChapterId);
      el.dataset.done = String(doneUpTo.some((c) => c.id === id));
    }
    if (!active?.location) return;
    const target = { center: [active.location.lng, active.location.lat] as [number, number], zoom: 12.2 };
    if (reducedMotion()) map.jumpTo(target);
    else map.flyTo({ ...target, speed: 0.9, curve: 1.5, essential: true, padding: { top: 20, bottom: 20, left: 20, right: 20 } });
  }, [activeChapterId, ready, active, activeIndex, located, project.chapters]);

  if (!located.length) return null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-soft">
      <div className={`absolute inset-0 p-6 transition-opacity duration-700 ${ready && !failed ? 'opacity-0' : 'opacity-100'}`}>
        <RouteSketch chapters={project.chapters} activeId={activeChapterId} />
      </div>
      <div
        ref={container}
        className={`absolute inset-0 transition-opacity duration-1000 ${ready && !failed ? 'opacity-100' : 'opacity-0'}`}
        style={{ filter: theme.mapFilter }}
        aria-label="Térkép"
      />
      {active && (
        <div className="pointer-events-none absolute left-3 top-3 max-w-[70%] rounded-xl bg-paper/85 px-3.5 py-2 shadow-sm backdrop-blur-md sm:left-5 sm:top-5">
          <p className="eyebrow !text-[0.6rem]">{String(activeIndex + 1).padStart(2, '0')} / {String(project.chapters.length).padStart(2, '0')}</p>
          <p className="font-display truncate text-lg italic leading-tight">{active.location?.name ?? active.location?.country ?? (active.location ? active.title : 'Hely nélkül')}</p>
        </div>
      )}
      {failed && (
        <p className="absolute bottom-2 right-3 text-[0.65rem] text-muted">Térkép nem elérhető – az út vázlata látszik</p>
      )}
    </div>
  );
}
