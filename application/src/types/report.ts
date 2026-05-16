export interface Report {
  id: string;
  diaryId: string;
  summary: string;
  emotions: string[];
  insights: string[];
  suggestions: string[];
  createdAt: string;
}
