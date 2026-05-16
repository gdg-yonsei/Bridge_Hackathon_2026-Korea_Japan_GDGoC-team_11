import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

export const lightTheme = {
  ...MD3LightTheme,
  roundness: 3,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#5C8A7A',
    onPrimary: '#FFFFFF',
    primaryContainer: '#D4E6E1',
    onPrimaryContainer: '#1A3B33',
    secondary: '#B8865C',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#F2DDD0',
    onSecondaryContainer: '#3D2415',
    tertiary: '#8B7BA8',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#E4DCEF',
    background: '#F8F4EF',
    onBackground: '#2C2420',
    surface: '#FFFFFF',
    onSurface: '#2C2420',
    surfaceVariant: '#EDE8E0',
    onSurfaceVariant: '#6B5E55',
    outline: '#9B8E85',
    outlineVariant: '#D4CBC3',
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  roundness: 3,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#8FB8AD',
    secondary: '#D4A87A',
    tertiary: '#B8A8D0',
  },
};

export type AppTheme = typeof lightTheme;
