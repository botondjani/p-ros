import type { ThemeId } from '../model/types';

export interface ThemeDef {
  id: ThemeId;
  label: string;
  /** OpenFreeMap stílus (ingyenes, kulcs nélkül). */
  mapStyle: string;
  /** CSS-szűrő a térkép-vásznon, hogy a csempék a téma színeihez illeszkedjenek. */
  mapFilter: string;
  swatch: [string, string, string];
}

export const THEMES: ThemeDef[] = [
  {
    id: 'papir',
    label: 'Papír',
    mapStyle: 'https://tiles.openfreemap.org/styles/positron',
    mapFilter: 'sepia(0.35) saturate(0.9) brightness(0.98)',
    swatch: ['#f4efe6', '#2b2420', '#b5532f'],
  },
  {
    id: 'ejszaka',
    label: 'Éjszaka',
    mapStyle: 'https://tiles.openfreemap.org/styles/dark',
    mapFilter: 'saturate(0.8) brightness(0.95)',
    swatch: ['#14161d', '#ece6da', '#e2b46b'],
  },
  {
    id: 'tenger',
    label: 'Tenger',
    mapStyle: 'https://tiles.openfreemap.org/styles/positron',
    mapFilter: 'hue-rotate(150deg) sepia(0.15) saturate(1.1)',
    swatch: ['#eef2f1', '#17302f', '#1f6f6a'],
  },
  {
    id: 'barack',
    label: 'Barack',
    mapStyle: 'https://tiles.openfreemap.org/styles/positron',
    mapFilter: 'sepia(0.4) hue-rotate(-25deg) saturate(1.05)',
    swatch: ['#f8ebe4', '#3a2230', '#9c3d63'],
  },
];

export const themeById = (id: ThemeId) => THEMES.find((t) => t.id === id) ?? THEMES[0];

export const THEME_BG: Record<ThemeId, string> = {
  papir: '#f4efe6',
  ejszaka: '#14161d',
  tenger: '#eef2f1',
  barack: '#f8ebe4',
};
