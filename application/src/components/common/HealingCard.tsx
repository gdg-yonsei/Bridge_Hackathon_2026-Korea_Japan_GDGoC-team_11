import React from 'react';
import { StyleSheet, ViewProps } from 'react-native';
import { Surface, useTheme } from 'react-native-paper';
import { tokens } from '@/theme/tokens';

interface HealingCardProps extends ViewProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'outlined' | 'flat' | 'floating';
}

export const HealingCard = ({ children, style, variant = 'elevated', ...props }: HealingCardProps) => {
  const theme = useTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case 'outlined':
        return {
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          elevation: 0,
        };
      case 'flat':
        return {
          elevation: 0,
          backgroundColor: theme.colors.surfaceVariant,
        };
      case 'floating':
        return {
          ...tokens.shadows.floating,
          backgroundColor: theme.colors.surface,
        };
      default:
        return {
          ...tokens.shadows.soft,
          backgroundColor: theme.colors.surface,
        };
    }
  };

  return (
    <Surface
      style={[
        styles.card,
        {
          borderRadius: tokens.roundness.lg,
        },
        getVariantStyles(),
        style,
      ]}
      elevation={0} // We use manual shadows for more control
      {...props}
    >
      {children}
    </Surface>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: tokens.spacing.lg,
    marginVertical: tokens.spacing.sm,
  },
});
