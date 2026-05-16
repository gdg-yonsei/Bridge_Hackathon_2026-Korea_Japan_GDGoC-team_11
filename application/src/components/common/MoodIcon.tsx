import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { emotionColors } from '@/theme';

export type MoodType = 'happy' | 'sad' | 'angry' | 'calm' | 'anxious';

interface MoodIconProps {
  mood: MoodType;
  size?: number;
}

const moodMap: Record<MoodType, { icon: string; color: string }> = {
  happy: { icon: 'emoticon-happy-outline', color: emotionColors.happy },
  sad: { icon: 'emoticon-sad-outline', color: emotionColors.sad },
  angry: { icon: 'emoticon-angry-outline', color: emotionColors.angry },
  calm: { icon: 'emoticon-neutral-outline', color: emotionColors.calm },
  anxious: { icon: 'emoticon-confused-outline', color: emotionColors.anxious },
};

export const MoodIcon = ({ mood, size = 24 }: MoodIconProps) => {
  const config = moodMap[mood];
  return (
    <MaterialCommunityIcons
      name={config.icon as any}
      size={size}
      color={config.color}
    />
  );
};
