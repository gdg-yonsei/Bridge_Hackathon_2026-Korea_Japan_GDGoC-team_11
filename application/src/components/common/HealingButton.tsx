import React from 'react';
import { Button, ButtonProps, useTheme } from 'react-native-paper';
import { tokens } from '@/theme/tokens';

interface HealingButtonProps extends Omit<ButtonProps, 'children'> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'tonal';
}

export const HealingButton = ({ children, variant = 'primary', style, ...props }: HealingButtonProps) => {
  const theme = useTheme();

  const getColors = () => {
    switch (variant) {
      case 'secondary':
        return {
          mode: 'contained' as const,
          buttonColor: theme.colors.secondary,
          textColor: theme.colors.onSecondary,
        };
      case 'tonal':
        return {
          mode: 'contained-tonal' as const,
        };
      default:
        return {
          mode: 'contained' as const,
          buttonColor: theme.colors.primary,
          textColor: theme.colors.onPrimary,
        };
    }
  };

  const { mode, buttonColor, textColor } = getColors();

  return (
    <Button
      mode={mode}
      buttonColor={buttonColor}
      textColor={textColor}
      style={[
        {
          borderRadius: tokens.roundness.full,
        },
        style,
      ]}
      contentStyle={{ paddingVertical: tokens.spacing.xs }}
      {...props}
    >
      {children}
    </Button>
  );
};
