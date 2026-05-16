import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper';

// "Healing Garden" Refined Palette
const palette = {
  primary: '#738F70',      // Deep Sage
  onPrimary: '#FFFFFF',
  primaryContainer: '#E3EDE1',
  onPrimaryContainer: '#2D3B2C',
  
  secondary: '#51624D',    // Forest Moss
  onSecondary: '#FFFFFF',
  secondaryContainer: '#DDE8DB',
  onSecondaryContainer: '#1B251B',
  
  tertiary: '#5D7E83',     // Misty River
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#E0F0F2',
  onTertiaryContainer: '#1A2E31',
  
  error: '#BA1A1A',
  
  background: '#FDFCF9',   // Very Soft Cream
  onBackground: '#1A1C19',
  
  surface: '#FFFFFF',
  onSurface: '#1C1D1B',
  surfaceVariant: '#F2F4F0',
  onSurfaceVariant: '#444842',
  
  outline: '#747971',
  outlineVariant: '#C4C8C0',
};

export const emotionColors = {
  happy: '#F4D35E',   // Sunlit Yellow
  sad: '#98B4B8',     // Muted Ocean
  angry: '#C66B56',   // Soft Terracotta
  calm: '#A8C2B8',    // Sage Mist
  anxious: '#A6A2C2', // Soft Lavender
  neutral: '#C2C4C1', // Slate Grey
};

const fontConfig = {
  displayLarge: { fontFamily: 'System', fontSize: 42, fontWeight: '700' as const, lineHeight: 52 },
  displayMedium: { fontFamily: 'System', fontSize: 32, fontWeight: '700' as const, lineHeight: 40 },
  headlineLarge: { fontFamily: 'System', fontSize: 28, fontWeight: '700' as const, lineHeight: 36 },
  titleLarge: { fontFamily: 'System', fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  titleMedium: { fontFamily: 'System', fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
  bodyLarge: { fontFamily: 'System', fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyMedium: { fontFamily: 'System', fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  labelLarge: { fontFamily: 'System', fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
};

export const lightTheme = {
  ...MD3LightTheme,
  fonts: configureFonts({ config: fontConfig }),
  colors: {
    ...MD3LightTheme.colors,
    ...palette,
  },
  roundness: 5,
};

export const darkTheme = {
  ...MD3DarkTheme,
  fonts: configureFonts({ config: fontConfig }),
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#B1CCAE',
    onPrimary: '#1E3720',
    background: '#121411',
    surface: '#1A1C19',
    surfaceVariant: '#2A2D28',
    onSurfaceVariant: '#C4C8C0',
    primaryContainer: '#3C4D3A',
    onPrimaryContainer: '#D1E6CE',
  },
};

export type AppTheme = typeof lightTheme;
export { tokens } from './tokens';
