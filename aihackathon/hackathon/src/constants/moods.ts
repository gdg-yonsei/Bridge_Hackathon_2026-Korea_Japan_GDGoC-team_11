import { MoodKey } from '../types';

export const MOODS: Record<
  MoodKey,
  {
    face: string;
    label: string;
    bg: string;
    textColor: string;
    insight: string;
    exercise: { title: string; description: string };
  }
> = {
  great: {
    face: '😊',
    label: 'Great',
    bg: '#d8f0e8',
    textColor: '#1a5a3a',
    insight:
      'Noticing positive emotions is a great CBT habit. Try to identify what specifically made today feel good — this reinforces healthy patterns over time.',
    exercise: {
      title: 'Gratitude log',
      description:
        'Write down 3 specific things that went well today and why they happened. Focus on your own role in making them happen.',
    },
  },
  okay: {
    face: '🙂',
    label: 'Okay',
    bg: '#e8f0d8',
    textColor: '#2a4a1a',
    insight:
      'A neutral-to-good day. Consider what small wins happened — building on those is a key CBT strategy for sustained wellbeing.',
    exercise: {
      title: 'Savoring exercise',
      description:
        'Recall one pleasant moment from today in full detail. What did you see, hear, and feel? Stay with it for 2 minutes.',
    },
  },
  neutral: {
    face: '😐',
    label: 'Neutral',
    bg: '#f0ecd8',
    textColor: '#4a3a1a',
    insight:
      'Flat days are common. Try a brief body scan: where do you feel tension right now? Naming physical sensations can unlock emotional clarity.',
    exercise: {
      title: 'Thought record',
      description:
        'Pick one moment from today. What was the automatic thought? What evidence supports it, and what contradicts it?',
    },
  },
  sad: {
    face: '😔',
    label: 'Sad',
    bg: '#e8dff0',
    textColor: '#3a2a5a',
    insight:
      'Acknowledging sadness takes courage. What thought came up most today? Writing it out is the first step in challenging automatic negative thinking.',
    exercise: {
      title: 'Cognitive reframe',
      description:
        'Write down the negative thought that keeps coming up. Then list 3 pieces of evidence that contradict or soften it.',
    },
  },
  bad: {
    face: '😢',
    label: 'Tough',
    bg: '#f0e0e8',
    textColor: '#5a1a2a',
    insight:
      'Tough days are valid. Your therapist will review this entry. If things feel overwhelming right now, please reach out to them directly.',
    exercise: {
      title: 'Grounding (5-4-3-2-1)',
      description:
        'Name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, and 1 you can taste. Breathe slowly through each.',
    },
  },
};

export const DETAIL_TAGS = [
  'Anxious',
  'Stressed',
  'Lonely',
  'Tired',
  'Excited',
  'Grateful',
  'Angry',
  'Scared',
  'Numb',
  'Hopeful',
  'Overwhelmed',
  'Calm',
];

export const WEEKLY_THEMES = [
  { name: 'Academic pressure', count: 3, color: '#7BC4A8' },
  { name: 'Peer relationships', count: 2, color: '#AFA9EC' },
  { name: 'Sleep difficulties', count: 2, color: '#FAC775' },
  { name: 'Self-doubt', count: 1, color: '#F4C0D1' },
];

export const MONTHLY_THEMES = [
  { name: 'Academic stress', count: 8, color: '#7BC4A8' },
  { name: 'Social anxiety', count: 6, color: '#AFA9EC' },
  { name: 'Catastrophizing', count: 5, color: '#F4C0D1' },
  { name: 'Sleep issues', count: 4, color: '#FAC775' },
  { name: 'Positive reframe', count: 4, color: '#9FE1CB' },
];

export const COLORS = {
  bg: '#eef6f2',
  paper: '#fffef5',
  paperLine: '#ece8dc',
  paperMargin: '#f0b8b8',
  ringBg: '#ede8d8',
  ringBorder: '#c8c0a8',
  green: '#2a7a5e',
  greenLight: '#d8f0e8',
  greenDark: '#1f6a50',
  text: '#1a3a2e',
  textMuted: '#7aaa9a',
  textDim: '#9a9080',
  border: '#d8e8e0',
  borderPaper: '#d8d0b8',
  white: '#ffffff',
  headerBg: '#e8dfc8',
  tagBg: '#f0e8d8',
  tagBorder: '#d8d0b8',
  tagText: '#6a5e4a',
  tagActiveBg: '#d8f0e8',
  tagActiveBorder: '#a8d8c0',
  tagActiveText: '#1a5a3a',
};
