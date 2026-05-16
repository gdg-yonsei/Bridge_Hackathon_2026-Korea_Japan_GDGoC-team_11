export interface Report {
  period_start: string;
  period_end: string;
  dominant_emotion: string;
  summary: string;
  mood_chart: Record<string, Record<string, number>>;
  stats: Record<string, {
    avg: number;
    peak: number;
    days: number;
  }>;
  model_name: string;
  generated_at: string;
}

export interface CreateReportRequest {
  period_start: string;
  period_end: string;
}
