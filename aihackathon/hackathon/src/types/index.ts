export type MoodKey = 'great' | 'okay' | 'neutral' | 'sad' | 'bad';

export interface JournalEntry {
  id: string;
  date: string;
  mood: MoodKey;
  tags: string[];
  content: string;
  wordCount: number;
  aiInsight?: string;
  aiDistortions?: string[];
  createdAt: number;
}

export type RootStackParamList = {
  Home: undefined;
  Report: { entry: JournalEntry };
};
