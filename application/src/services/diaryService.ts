import { api } from './api';
import type { Emotion } from '@/data/mock';

// ── Backend shapes ───────────────────────────────────────────────────────────

type DiaryStatus = 'pending' | 'analyzing' | 'done' | 'failed';

type DiaryListItem = {
  entry_id: number;
  entry_date: string; // YYYY-MM-DD
  primary_emotion: Emotion | null;
  status: DiaryStatus;
};

export type DiaryAccepted = {
  entry_id: number;
  entry_date: string;
  status: DiaryStatus;
};

// ── Mapping ──────────────────────────────────────────────────────────────────

function toFrontendEmotion(e: string | null): Emotion | null {
  return e ? (e as Emotion) : null;
}

// ── Public types used by the UI ──────────────────────────────────────────────

export type CalendarEntry = {
  entry_id: number;
  emotion: Emotion | null;
  status: DiaryStatus;
};

export type DiaryDetail = {
  id: number;
  entry_date: string;
  title: string | null;
  content: string;
  status: DiaryStatus;
  emotion: Emotion | null;
  summary: string | null;
  solis_message: string | null;
  suggested_action: string | null;
  crisis_score: number | null;
  needs_hotline: boolean;
};

// ── Service ──────────────────────────────────────────────────────────────────

export const diaryService = {
  /** Fetch one month of entries, keyed by YYYY-MM-DD. Month is 1-indexed. */
  async getMonth(year: number, month: number): Promise<Record<string, CalendarEntry>> {
    const items = await api.get<DiaryListItem[]>(`/diary?year=${year}&month=${month}`);
    const record: Record<string, CalendarEntry> = {};
    for (const item of items) {
      record[item.entry_date] = {
        entry_id: item.entry_id,
        emotion:  toFrontendEmotion(item.primary_emotion),
        status:   item.status,
      };
    }
    return record;
  },

  /** Fetch full detail of a single entry. */
  async getDetail(entryId: number): Promise<DiaryDetail> {
    type Raw = {
      id: number; entry_date: string; title: string | null; content: string;
      status: DiaryStatus;
      primary_emotion?: Emotion | null;
      emotion_summary?: string | null;
      solis_message?: string | null;
      suggested_action?: string | null;
      crisis_score?: number | null;
      needs_hotline?: boolean;
    };
    const raw = await api.get<Raw>(`/diary/${entryId}`);
    return {
      id:               raw.id,
      entry_date:       raw.entry_date,
      title:            raw.title,
      content:          raw.content,
      status:           raw.status,
      emotion:          toFrontendEmotion(raw.primary_emotion ?? null),
      summary:          raw.emotion_summary ?? null,
      solis_message:    raw.solis_message ?? null,
      suggested_action: raw.suggested_action ?? null,
      crisis_score:     raw.crisis_score ?? null,
      needs_hotline:    raw.needs_hotline ?? false,
    };
  },

  /** Create a new diary entry. entry_date must be YYYY-MM-DD. */
  create(data: { entry_date: string; content: string; title?: string }): Promise<DiaryAccepted> {
    return api.post<DiaryAccepted>('/diary', data);
  },

  /** Update an existing diary entry. entryId is required. */
  update(entryId: number, data: { content: string; title?: string }): Promise<DiaryAccepted> {
    return api.put<DiaryAccepted>(`/diary/${entryId}`, data);
  },
};
