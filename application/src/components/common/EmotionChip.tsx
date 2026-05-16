import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { tokens } from '@/theme/tokens';
import { Emotion, EMOTION_COLORS, EMOTION_EMOJIS, EMOTION_LABELS } from '@/data/mock';

interface EmotionChipProps {
  emotion: Emotion;
  showLabel?: boolean;
}

export const EmotionChip = ({ emotion, showLabel = true }: EmotionChipProps) => {
  const theme = useTheme();
  const color = EMOTION_COLORS[emotion];

  return (
    <View style={[styles.container, { backgroundColor: color + '22' }]}>
      <Text style={styles.emoji}>{EMOTION_EMOJIS[emotion]}</Text>
      {showLabel && (
        <Text
          variant="labelMedium"
          style={[styles.label, { color: color === '#C2C4C1' ? theme.colors.onSurface : color }]}
        >
          {EMOTION_LABELS[emotion]}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs + 2,
    borderRadius: tokens.roundness.full,
    gap: tokens.spacing.xs,
  },
  emoji: {
    fontSize: 14,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
