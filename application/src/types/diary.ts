export interface Diary {
  id: string;
  userId: string;
  title: string;
  content: string;
  mood?: 'great' | 'good' | 'neutral' | 'bad' | 'terrible';
  entry_date: string;
  createdAt: string;
  updatedAt: string;
  reportId?: string;
}

export interface CreateDiaryRequest {
  entry_date: string;
  title: string;
  content: string;
}
