import { useTheme } from '../context/ThemeContext';

/**
 * Recharts takes colors as SVG attributes, where CSS variables do not resolve,
 * so the chart palette is picked in JS from the theme in effect.
 */
const PALETTES = {
  light: { grid: '#e5e7eb', axis: '#6b7280', cursor: '#f3f4f6', legend: '#6b7280', line: '#e83e8c' },
  dark: { grid: '#2b2b2b', axis: '#9ca3af', cursor: '#1c1c1c', legend: '#9ca3af', line: '#f06bb0' },
};

export function useChartTheme() {
  const { resolved } = useTheme();
  return PALETTES[resolved] || PALETTES.light;
}
