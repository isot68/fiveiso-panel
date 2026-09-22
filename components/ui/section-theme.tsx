import { createContext, useContext, type CSSProperties } from 'react';
export const sectionColors: Record<string, string> = {
  players: '#b889f5', accounts: '#eea978', map: '#65d8aa', vehicles: '#5dd5c5',
  items: '#86d99b', jobs: '#a3d574', factions: '#cad775', audit: '#e7cc82',
  console: '#b7c1d1', resources: '#edabb5', team: '#ea869e', settings: '#a6b5ce',
};
export const SectionTheme = createContext<string | null>(null);
export function useSectionTheme(): CSSProperties | undefined {
  const section = useContext(SectionTheme);
  if (!section) return undefined;
  const color = sectionColors[section] || '#61dce6';
  return { '--section-color': color, '--primary': color, '--ring': color,
    '--accent': `color-mix(in srgb, ${color} 18%, #152035)`, '--accent-foreground': color,
    borderTop: `3px solid ${color}`, '--popover': `color-mix(in srgb, ${color} 7%, #152035)` } as CSSProperties;
}
