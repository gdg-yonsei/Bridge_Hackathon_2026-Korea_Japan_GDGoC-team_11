import { emotionColors } from '@/theme';

export type Emotion = 'joy' | 'sadness' | 'anger' | 'anxiety' | 'calm' | 'neutral';

export const EMOTION_COLORS: Record<Emotion, string> = {
  joy: emotionColors.happy,
  sadness: emotionColors.sad,
  anger: emotionColors.angry,
  anxiety: emotionColors.anxious,
  calm: emotionColors.calm,
  neutral: '#C2C4C1', // Slate Grey for neutral
};

export const EMOTION_LABELS: Record<Emotion, string> = {
  joy: 'Joyful',
  sadness: 'Quiet',
  anger: 'Intense',
  anxiety: 'Unsettled',
  calm: 'Peaceful',
  neutral: 'Balanced',
};

export const EMOTION_EMOJIS: Record<Emotion, string> = {
  joy: '🌿',
  sadness: '☁️',
  anger: '🔥',
  anxiety: '🌪️',
  calm: '🍃',
  neutral: '🐚',
};

export type DiaryEntry = {
  emotion: Emotion;
  snippet: string;
};

export const MOCK_ENTRIES: Record<string, DiaryEntry> = {
  '2026-05-01': { emotion: 'joy', snippet: 'First day of May, feeling great!' },
  '2026-05-02': { emotion: 'calm', snippet: 'Quiet and peaceful day working from home.' },
  '2026-05-04': { emotion: 'anxiety', snippet: 'Big presentation tomorrow, feeling nervous.' },
  '2026-05-05': { emotion: 'anger', snippet: 'Traffic was terrible. So frustrated.' },
  '2026-05-06': { emotion: 'calm', snippet: "Recovered from yesterday's stress." },
  '2026-05-07': { emotion: 'joy', snippet: 'Amazing dinner with the team!' },
  '2026-05-08': { emotion: 'joy', snippet: 'Got great feedback on the project.' },
  '2026-05-09': { emotion: 'joy', snippet: 'Weekend hike was amazing.' },
  '2026-05-10': { emotion: 'sadness', snippet: 'Missing friends back home.' },
  '2026-05-11': { emotion: 'neutral', snippet: 'Just a regular Monday.' },
  '2026-05-12': { emotion: 'neutral', snippet: 'Productive but uneventful day.' },
  '2026-05-13': { emotion: 'calm', snippet: 'Morning meditation helped a lot.' },
  '2026-05-14': { emotion: 'anxiety', snippet: 'Deadlines are piling up this week.' },
  '2026-05-15': { emotion: 'joy', snippet: 'Bridge hackathon team meeting went perfectly!' },
};
