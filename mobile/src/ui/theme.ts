import { useColorScheme } from 'react-native';

const light = {
  bg: '#F4F6F5',
  card: '#FFFFFF',
  cardAlt: '#EEF2F1',
  text: '#0F1A17',
  muted: '#5D6B67',
  faint: '#93A09C',
  border: '#E1E7E5',
  primary: '#0F8B6C',
  primaryText: '#FFFFFF',
  primarySoft: '#DDF3EC',
  income: '#16A34A',
  expense: '#E5484D',
  warn: '#D97706',
  warnSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  track: '#E6ECEA',
  hero: '#0F8B6C',
  heroText: '#FFFFFF',
  heroMuted: 'rgba(255,255,255,0.75)',
};

const dark: typeof light = {
  bg: '#0B1110',
  card: '#141C1A',
  cardAlt: '#1B2522',
  text: '#ECF3F0',
  muted: '#9AAAA5',
  faint: '#66756F',
  border: '#24302D',
  primary: '#34C79B',
  primaryText: '#04140F',
  primarySoft: '#123128',
  income: '#4ADE80',
  expense: '#FB7185',
  warn: '#FBBF24',
  warnSoft: '#3A2B0B',
  danger: '#F87171',
  dangerSoft: '#3B1414',
  track: '#22302C',
  hero: '#0F6E57',
  heroText: '#FFFFFF',
  heroMuted: 'rgba(255,255,255,0.72)',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;
