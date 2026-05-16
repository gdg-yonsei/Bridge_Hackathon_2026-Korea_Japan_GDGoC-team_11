export interface Diary {
  id: string;
  userId: string;
  title: string;
  content: string;
  mood?: 'great' | 'good' | 'neutral' | 'bad' | 'terrible';
  createdAt: string;
  updatedAt: string;
  reportId?: string;
}

export interface CreateDiaryRequest {
  title: string;
  content: string;
  mood?: Diary['mood'];
}
