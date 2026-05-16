export type Therapist = {
  therapist_id: string;
  name: string;
  location: string;
  languages: string[];
  certifications: string[];
  approach: string[];
  specializes_in: string[];
  emotions_treated: string[];
  online_available: boolean;
  in_person_available: boolean;
  years_experience: number;
  education: string;
  bio: string;
  price_per_session: string;
  rating: number;
};

export type TherapistFilter = {
  country?: 'Korea' | 'Japan';
  language?: string;
  concern?: string;
  emotion?: string;
  online?: boolean;
  in_person?: boolean;
  min_rating?: number;
};
