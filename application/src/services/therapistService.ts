import { api } from './api';
import type { Therapist, TherapistFilter } from '@/types/therapist';

function buildQuery(filter: TherapistFilter): string {
  const params = new URLSearchParams();
  if (filter.country)    params.set('country', filter.country);
  if (filter.language)   params.set('language', filter.language);
  if (filter.concern)    params.set('concern', filter.concern);
  if (filter.emotion)    params.set('emotion', filter.emotion);
  if (filter.online    != null) params.set('online', String(filter.online));
  if (filter.in_person != null) params.set('in_person', String(filter.in_person));
  if (filter.min_rating != null) params.set('min_rating', String(filter.min_rating));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export type TherapistMatchRequest = {
  emotion?: string;
  context?: string;
};

export const therapistService = {
  list: (filter: TherapistFilter = {}) =>
    api.get<Therapist[]>(`/therapist${buildQuery(filter)}`),

  match: (body: TherapistMatchRequest) =>
    api.post<Therapist[]>('/therapist/match', body),
};
