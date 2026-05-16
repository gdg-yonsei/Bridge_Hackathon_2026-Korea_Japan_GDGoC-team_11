import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

const palette = {
  primary: '#6750A4',
  secondary: '#625B71',
  tertiary: '#7D5260',
};

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: palette.primary,
    secondary: palette.secondary,
    tertiary: palette.tertiary,
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#D0BCFF',
    secondary: '#CCC2DC',
    tertiary: '#EFB8C8',
  },
};

export type AppTheme = typeof lightTheme;
