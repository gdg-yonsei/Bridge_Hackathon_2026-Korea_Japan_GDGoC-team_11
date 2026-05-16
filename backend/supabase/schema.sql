-- Supabase initial schema + RLS.
-- Apply: Supabase Dashboard → SQL Editor → paste and Run.
-- Idempotent — safe to run multiple times (handles migration from older shapes).

-- =====================================================================
-- 1. enums
-- =====================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'diary_status') then
    create type public.diary_status as enum ('pending', 'analyzing', 'done', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'emotion') then
    create type public.emotion as enum (
      'joy', 'sad', 'anger', 'anxiety', 'calm',
      'embarrassment', 'envy', 'boredom', 'nostalgia'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'message_role') then
    create type public.message_role as enum ('user', 'assistant', 'system');
  end if;
end$$;

-- Expand legacy 5-value emotion enum with the 4 new values (no-op if present).
alter type public.emotion add value if not exists 'embarrassment';
alter type public.emotion add value if not exists 'envy';
alter type public.emotion add value if not exists 'boredom';
alter type public.emotion add value if not exists 'nostalgia';

-- =====================================================================
-- 2. profiles (1:1 with auth.users)
-- =====================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       varchar(255),
  nickname    varchar(50),
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =====================================================================
-- 3. diary_entries — emotion analysis and Solis fields are stored inline.
--    `scores` carries all 9 emotions as floats in [0, 1]; `primary_emotion`
--    is the argmax computed app-side after analysis.
-- =====================================================================
create table if not exists public.diary_entries (
  id                bigserial primary key,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  entry_date        date not null,
  title             varchar(200),
  content           text not null,
  status            diary_status not null default 'pending',
  primary_emotion   emotion,
  scores            jsonb,
  emotion_summary   text,
  emotion_model     varchar(100),
  emotion_raw       jsonb,
  crisis_score      double precision,
  solis_message     text,
  suggested_action  text,
  needs_hotline     boolean not null default false,
  songs             jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint uq_user_entry_date unique (user_id, entry_date)
);

-- Migration: add new columns; drop legacy 5-int intensity columns.
alter table public.diary_entries
  add column if not exists scores           jsonb,
  add column if not exists crisis_score     double precision,
  add column if not exists solis_message    text,
  add column if not exists suggested_action text,
  add column if not exists needs_hotline    boolean default false,
  drop column if exists joy_intensity,
  drop column if exists sad_intensity,
  drop column if exists anger_intensity,
  drop column if exists anxiety_intensity,
  drop column if exists calm_intensity;

update public.diary_entries set needs_hotline = false where needs_hotline is null;
alter table public.diary_entries alter column needs_hotline set not null;
alter table public.diary_entries alter column needs_hotline set default false;

create index if not exists ix_diary_entries_user_id on public.diary_entries (user_id);
create index if not exists ix_diary_entries_date    on public.diary_entries (entry_date);

-- Drop legacy tables (replaced by inline columns above).
drop table if exists public.emotion_analyses     cascade;
drop table if exists public.song_recommendations cascade;

-- =====================================================================
-- 4. reports — period summaries. Re-running the same window upserts.
-- =====================================================================
create table if not exists public.reports (
  id                bigserial primary key,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  period_start      date not null,
  period_end        date not null,
  dominant_emotion  emotion not null,
  summary           text not null,
  mood_chart        jsonb not null,
  stats             jsonb not null,
  model_name        varchar(100),
  generated_at      timestamptz not null default now(),
  constraint uq_user_report_period unique (user_id, period_start, period_end)
);

alter table public.reports
  add column if not exists stats jsonb;
update public.reports set stats = '{}'::jsonb where stats is null;
alter table public.reports alter column stats set not null;

create index if not exists ix_reports_user_id on public.reports (user_id);

-- =====================================================================
-- 5. conversations + messages — Solis chatbot.
-- =====================================================================
create table if not exists public.conversations (
  id              bigserial primary key,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  diary_entry_id  bigint references public.diary_entries(id) on delete cascade,
  title           varchar(120),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.conversations
  drop constraint if exists conversations_diary_entry_id_key;
alter table public.conversations
  alter column diary_entry_id drop not null,
  add column if not exists title varchar(120);

create index if not exists ix_conversations_user_id        on public.conversations (user_id);
create index if not exists ix_conversations_diary_entry_id on public.conversations (diary_entry_id);

create table if not exists public.messages (
  id              bigserial primary key,
  conversation_id bigint not null references public.conversations(id) on delete cascade,
  role            message_role not null,
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists ix_messages_conversation_id on public.messages (conversation_id);

-- =====================================================================
-- 6. therapists — read-only directory powering the matcher.
-- =====================================================================
create table if not exists public.therapists (
  therapist_id        varchar(32) primary key,
  name                varchar(120) not null,
  location            varchar(120) not null,
  languages           jsonb not null,
  certifications      jsonb not null,
  approach            jsonb not null,
  specializes_in      jsonb not null,
  emotions_treated    jsonb not null,
  online_available    boolean not null default false,
  in_person_available boolean not null default false,
  years_experience    int,
  education           text,
  bio                 text,
  price_per_session   varchar(64),
  rating              double precision
);

-- Seed: idempotent — re-running this file refreshes the directory in place.
-- Source of truth lives here, not in any external JSON file.
insert into public.therapists (
  therapist_id, name, location, languages, certifications, approach,
  specializes_in, emotions_treated, online_available, in_person_available,
  years_experience, education, bio, price_per_session, rating
)
select
  therapist_id, name, location, languages, certifications, approach,
  specializes_in, emotions_treated, online_available, in_person_available,
  years_experience, education, bio, price_per_session, rating
from jsonb_to_recordset($SEED$
[
  {
    "therapist_id": "KR001",
    "name": "Dr. Kim Soo-Yeon",
    "location": "Seoul, Korea",
    "languages": ["Korean", "English"],
    "certifications": ["Licensed Clinical Psychologist (임상심리사 1급)", "Certified CBT Therapist", "National Mental Health Counselor"],
    "approach": ["CBT", "Mindfulness-Based Cognitive Therapy"],
    "specializes_in": ["anxiety", "embarrassment", "workplace stress", "self-esteem", "perfectionism"],
    "emotions_treated": ["anxiety", "embarrassment", "anger", "sad"],
    "online_available": true,
    "in_person_available": true,
    "years_experience": 10,
    "education": "Ph.D. Clinical Psychology, Seoul National University",
    "bio": "Specializes in helping professionals overcome workplace anxiety and shame using evidence-based CBT techniques. Experienced working with Korean corporate culture.",
    "price_per_session": "100,000 KRW",
    "rating": 4.9
  },
  {
    "therapist_id": "KR002",
    "name": "Park Ji-Ho",
    "location": "Seoul, Korea",
    "languages": ["Korean"],
    "certifications": ["Licensed Counseling Psychologist (상담심리사 1급)", "Certified Mindfulness Instructor", "Trauma-Focused CBT Certified"],
    "approach": ["Mindfulness", "ACT", "Trauma-Focused CBT"],
    "specializes_in": ["sad", "nostalgia", "grief", "depression", "loss"],
    "emotions_treated": ["sad", "nostalgia", "calm", "anxiety"],
    "online_available": true,
    "in_person_available": true,
    "years_experience": 7,
    "education": "M.A. Counseling Psychology, Yonsei University",
    "bio": "Gentle and patient counselor specializing in grief, loss, and nostalgic longing. Creates a safe space for processing deep emotions.",
    "price_per_session": "80,000 KRW",
    "rating": 4.8
  },
  {
    "therapist_id": "KR003",
    "name": "Dr. Choi Min-Jun",
    "location": "Busan, Korea",
    "languages": ["Korean", "English"],
    "certifications": ["Licensed Clinical Psychologist (임상심리사 1급)", "Anger Management Specialist", "Certified CBT Therapist"],
    "approach": ["CBT", "Dialectical Behavior Therapy (DBT)", "Emotion Regulation"],
    "specializes_in": ["anger", "envy", "frustration", "impulse control", "workplace conflict"],
    "emotions_treated": ["anger", "envy", "anxiety", "embarrassment"],
    "online_available": true,
    "in_person_available": true,
    "years_experience": 12,
    "education": "Ph.D. Clinical Psychology, Pusan National University",
    "bio": "Expert in anger management and emotion regulation. Helps clients understand the root of envy and frustration and channel them constructively.",
    "price_per_session": "90,000 KRW",
    "rating": 4.7
  },
  {
    "therapist_id": "KR004",
    "name": "Lee Hana",
    "location": "Seoul, Korea",
    "languages": ["Korean", "Japanese"],
    "certifications": ["Licensed Counseling Psychologist (상담심리사 1급)", "Positive Psychology Practitioner", "Certified Joy and Wellbeing Coach"],
    "approach": ["Positive Psychology", "Solution-Focused Therapy", "Strengths-Based"],
    "specializes_in": ["joy", "boredom", "motivation", "life purpose", "burnout recovery"],
    "emotions_treated": ["boredom", "joy", "calm", "sad"],
    "online_available": true,
    "in_person_available": false,
    "years_experience": 5,
    "education": "M.A. Counseling Psychology, Korea University",
    "bio": "Focuses on rebuilding joy and motivation in people experiencing boredom, emptiness, or burnout. Speaks Korean and Japanese fluently.",
    "price_per_session": "70,000 KRW",
    "rating": 4.8
  },
  {
    "therapist_id": "KR005",
    "name": "Dr. Jung Seo-Yun",
    "location": "Seoul, Korea",
    "languages": ["Korean", "English"],
    "certifications": ["Licensed Clinical Psychologist (임상심리사 1급)", "Schema Therapy Certified", "Shame Resilience Certified Practitioner"],
    "approach": ["Schema Therapy", "CBT", "Shame Resilience"],
    "specializes_in": ["embarrassment", "envy", "self-worth", "social anxiety", "people pleasing"],
    "emotions_treated": ["embarrassment", "envy", "anxiety", "sad"],
    "online_available": true,
    "in_person_available": true,
    "years_experience": 9,
    "education": "Ph.D. Psychology, KAIST",
    "bio": "Specializes in shame resilience and social anxiety. Helps clients rebuild self-worth after public embarrassment or social comparison.",
    "price_per_session": "110,000 KRW",
    "rating": 4.9
  },
  {
    "therapist_id": "KR006",
    "name": "Yoon Tae-Yang",
    "location": "Incheon, Korea",
    "languages": ["Korean"],
    "certifications": ["Licensed Counseling Psychologist (상담심리사 2급)", "Mindfulness-Based Stress Reduction (MBSR) Certified", "Sleep and Anxiety Specialist"],
    "approach": ["MBSR", "Mindfulness", "Relaxation Therapy"],
    "specializes_in": ["anxiety", "calm", "sleep issues", "stress", "work-life balance"],
    "emotions_treated": ["anxiety", "calm", "boredom", "sad"],
    "online_available": true,
    "in_person_available": true,
    "years_experience": 6,
    "education": "M.A. Psychology, Inha University",
    "bio": "Helps clients find calm amidst anxiety through mindfulness and stress reduction techniques. Specializes in sleep disorders related to anxiety.",
    "price_per_session": "65,000 KRW",
    "rating": 4.6
  },
  {
    "therapist_id": "KR007",
    "name": "Dr. Han Soo-Jin",
    "location": "Daegu, Korea",
    "languages": ["Korean", "English"],
    "certifications": ["Licensed Clinical Psychologist (임상심리사 1급)", "Grief and Loss Specialist", "Nostalgia and Life Transitions Counselor"],
    "approach": ["Narrative Therapy", "Existential Therapy", "Grief Counseling"],
    "specializes_in": ["nostalgia", "sad", "grief", "life transitions", "identity"],
    "emotions_treated": ["nostalgia", "sad", "calm", "joy"],
    "online_available": true,
    "in_person_available": true,
    "years_experience": 14,
    "education": "Ph.D. Counseling Psychology, Kyungpook National University",
    "bio": "Expert in helping clients process nostalgia, grief, and major life transitions. Uses narrative therapy to help clients rewrite their story.",
    "price_per_session": "85,000 KRW",
    "rating": 4.9
  },
  {
    "therapist_id": "KR008",
    "name": "Shin Bo-Ra",
    "location": "Seoul, Korea",
    "languages": ["Korean"],
    "certifications": ["Licensed Counseling Psychologist (상담심리사 1급)", "Art Therapy Certified", "Depression and Mood Disorder Specialist"],
    "approach": ["Art Therapy", "CBT", "Interpersonal Therapy"],
    "specializes_in": ["sad", "boredom", "depression", "creativity", "self-expression"],
    "emotions_treated": ["sad", "boredom", "calm", "joy"],
    "online_available": false,
    "in_person_available": true,
    "years_experience": 8,
    "education": "M.A. Art Therapy, Ewha Womans University",
    "bio": "Uses creative expression through art therapy to help clients process sadness and boredom. Particularly effective for those who struggle to verbalize emotions.",
    "price_per_session": "75,000 KRW",
    "rating": 4.7
  },
  {
    "therapist_id": "KR009",
    "name": "Dr. Oh Jae-Won",
    "location": "Seoul, Korea",
    "languages": ["Korean", "English"],
    "certifications": ["Licensed Clinical Psychologist (임상심리사 1급)", "Organizational Psychology Specialist", "Workplace Mental Health Certified"],
    "approach": ["CBT", "Solution-Focused Therapy", "Coaching Psychology"],
    "specializes_in": ["anger", "envy", "workplace stress", "leadership", "career burnout"],
    "emotions_treated": ["anger", "envy", "anxiety", "embarrassment"],
    "online_available": true,
    "in_person_available": true,
    "years_experience": 11,
    "education": "Ph.D. Organizational Psychology, Sungkyunkwan University",
    "bio": "Expert in workplace mental health, helping professionals manage anger, envy, and career-related stress in competitive Korean work environments.",
    "price_per_session": "120,000 KRW",
    "rating": 4.8
  },
  {
    "therapist_id": "KR010",
    "name": "Im Ye-Jin",
    "location": "Gwangju, Korea",
    "languages": ["Korean"],
    "certifications": ["Licensed Counseling Psychologist (상담심리사 1급)", "Youth and Young Adult Specialist", "Anxiety and Phobia Treatment Certified"],
    "approach": ["CBT", "Exposure Therapy", "Acceptance and Commitment Therapy (ACT)"],
    "specializes_in": ["anxiety", "embarrassment", "social anxiety", "academic stress", "self-confidence"],
    "emotions_treated": ["anxiety", "embarrassment", "sad", "anger"],
    "online_available": true,
    "in_person_available": true,
    "years_experience": 5,
    "education": "M.A. Clinical Psychology, Chonnam National University",
    "bio": "Specializes in helping young adults overcome social anxiety and embarrassment. Creates a judgment-free space for exploring difficult emotions.",
    "price_per_session": "60,000 KRW",
    "rating": 4.7
  },
  {
    "therapist_id": "JP001",
    "name": "Dr. Tanaka Yuki",
    "location": "Tokyo, Japan",
    "languages": ["Japanese", "English"],
    "certifications": ["Licensed Clinical Psychologist (公認心理師)", "Certified CBT Therapist (日本認知療法・認知行動療法学会)", "Mindfulness-Based Cognitive Therapy Certified"],
    "approach": ["CBT", "MBCT", "Psychodynamic"],
    "specializes_in": ["anxiety", "embarrassment", "workplace stress", "perfectionism", "self-worth"],
    "emotions_treated": ["anxiety", "embarrassment", "sad", "anger"],
    "online_available": true,
    "in_person_available": true,
    "years_experience": 12,
    "education": "Ph.D. Clinical Psychology, University of Tokyo",
    "bio": "Experienced in treating anxiety and shame in Japanese professionals. Sensitive to cultural pressures around performance and public image.",
    "price_per_session": "15,000 JPY",
    "rating": 4.9
  },
  {
    "therapist_id": "JP002",
    "name": "Sato Haruki",
    "location": "Osaka, Japan",
    "languages": ["Japanese"],
    "certifications": ["Licensed Clinical Psychologist (公認心理師)", "Mindfulness Instructor Certified", "Burnout and Fatigue Specialist"],
    "approach": ["Mindfulness", "ACT", "Rest and Recovery Therapy"],
    "specializes_in": ["boredom", "calm", "burnout", "fatigue", "motivation"],
    "emotions_treated": ["boredom", "calm", "sad", "anxiety"],
    "online_available": true,
    "in_person_available": true,
    "years_experience": 8,
    "education": "M.A. Psychology, Osaka University",
    "bio": "Helps clients reconnect with meaning and motivation after burnout and emotional numbness. Specializes in boredom as a symptom of deeper disconnection.",
    "price_per_session": "12,000 JPY",
    "rating": 4.7
  },
  {
    "therapist_id": "JP003",
    "name": "Dr. Yamamoto Aiko",
    "location": "Tokyo, Japan",
    "languages": ["Japanese", "English"],
    "certifications": ["Licensed Clinical Psychologist (公認心理師)", "Grief and Bereavement Counselor", "Existential Therapy Certified"],
    "approach": ["Existential Therapy", "Narrative Therapy", "Grief Counseling"],
    "specializes_in": ["nostalgia", "sad", "grief", "meaning", "loss"],
    "emotions_treated": ["nostalgia", "sad", "calm", "joy"],
    "online_available": true,
    "in_person_available": true,
    "years_experience": 15,
    "education": "Ph.D. Clinical Psychology, Kyoto University",
    "bio": "Expert in grief, nostalgia, and existential questions about meaning. Helps clients honor the past while building a meaningful present.",
    "price_per_session": "18,000 JPY",
    "rating": 4.9
  },
  {
    "therapist_id": "JP004",
    "name": "Watanabe Kenji",
    "location": "Nagoya, Japan",
    "languages": ["Japanese"],
    "certifications": ["Licensed Clinical Psychologist (公認心理師)", "Anger Management Specialist", "DBT Certified Therapist"],
    "approach": ["DBT", "Emotion Regulation", "Anger Management"],
    "specializes_in": ["anger", "envy", "frustration", "conflict resolution", "emotional regulation"],
    "emotions_treated": ["anger", "envy", "anxiety", "embarrassment"],
    "online_available": true,
    "in_person_available": true,
    "years_experience": 10,
    "education": "M.A. Clinical Psychology, Nagoya University",
    "bio": "Specializes in anger and envy management using DBT techniques. Helps clients understand emotional triggers and develop healthier responses.",
    "price_per_session": "13,000 JPY",
    "rating": 4.6
  },
  {
    "therapist_id": "JP005",
    "name": "Dr. Nakamura Hana",
    "location": "Tokyo, Japan",
    "languages": ["Japanese", "Korean", "English"],
    "certifications": ["Licensed Clinical Psychologist (公認心理師)", "Schema Therapy Certified", "Cross-Cultural Psychology Specialist"],
    "approach": ["Schema Therapy", "CBT", "Cross-Cultural Counseling"],
    "specializes_in": ["embarrassment", "envy", "self-worth", "cultural identity", "social pressure"],
    "emotions_treated": ["embarrassment", "envy", "anxiety", "sad"],
    "online_available": true,
    "in_person_available": true,
    "years_experience": 9,
    "education": "Ph.D. Cross-Cultural Psychology, Waseda University",
    "bio": "Uniquely positioned to help Korean and Japanese clients navigate cultural shame and social pressure. Speaks Korean, Japanese, and English.",
    "price_per_session": "16,000 JPY",
    "rating": 4.9
  },
  {
    "therapist_id": "JP006",
    "name": "Kobayashi Rin",
    "location": "Kyoto, Japan",
    "languages": ["Japanese"],
    "certifications": ["Licensed Clinical Psychologist (公認心理師)", "Positive Psychology Practitioner", "Joy and Flourishing Certified Coach"],
    "approach": ["Positive Psychology", "Strengths-Based Therapy", "Behavioral Activation"],
    "specializes_in": ["joy", "boredom", "depression", "life satisfaction", "creativity"],
    "emotions_treated": ["boredom", "joy", "calm", "sad"],
    "online_available": true,
    "in_person_available": false,
    "years_experience": 6,
    "education": "M.A. Psychology, Kyoto University",
    "bio": "Helps clients rediscover joy and meaning through positive psychology and behavioral activation. Specializes in depression presenting as boredom or emptiness.",
    "price_per_session": "11,000 JPY",
    "rating": 4.8
  },
  {
    "therapist_id": "JP007",
    "name": "Dr. Ito Masashi",
    "location": "Fukuoka, Japan",
    "languages": ["Japanese", "English"],
    "certifications": ["Licensed Clinical Psychologist (公認心理師)", "Workplace Mental Health Specialist", "Organizational Stress Counselor"],
    "approach": ["CBT", "Solution-Focused Therapy", "Stress Inoculation Training"],
    "specializes_in": ["anxiety", "anger", "workplace stress", "karoshi prevention", "work-life balance"],
    "emotions_treated": ["anxiety", "anger", "embarrassment", "boredom"],
    "online_available": true,
    "in_person_available": true,
    "years_experience": 13,
    "education": "Ph.D. Occupational Psychology, Kyushu University",
    "bio": "Expert in Japanese workplace stress and karoshi (overwork) prevention. Helps professionals set boundaries and manage work-related anger and anxiety.",
    "price_per_session": "14,000 JPY",
    "rating": 4.8
  },
  {
    "therapist_id": "JP008",
    "name": "Fujimoto Sakura",
    "location": "Sapporo, Japan",
    "languages": ["Japanese"],
    "certifications": ["Licensed Clinical Psychologist (公認心理師)", "EMDR Certified Therapist", "Anxiety and Trauma Specialist"],
    "approach": ["EMDR", "Trauma-Focused CBT", "Somatic Therapy"],
    "specializes_in": ["anxiety", "sad", "trauma", "PTSD", "fear"],
    "emotions_treated": ["anxiety", "sad", "anger", "calm"],
    "online_available": true,
    "in_person_available": true,
    "years_experience": 11,
    "education": "M.A. Clinical Psychology, Hokkaido University",
    "bio": "Specializes in trauma and anxiety using EMDR and somatic approaches. Creates a deeply safe environment for processing difficult experiences.",
    "price_per_session": "13,500 JPY",
    "rating": 4.7
  },
  {
    "therapist_id": "JP009",
    "name": "Dr. Hayashi Tomoko",
    "location": "Tokyo, Japan",
    "languages": ["Japanese", "English"],
    "certifications": ["Licensed Clinical Psychologist (公認心理師)", "Interpersonal Therapy Certified", "Depression and Mood Specialist"],
    "approach": ["Interpersonal Therapy", "CBT", "Behavioral Activation"],
    "specializes_in": ["sad", "nostalgia", "depression", "relationships", "loneliness"],
    "emotions_treated": ["sad", "nostalgia", "calm", "anxiety"],
    "online_available": true,
    "in_person_available": true,
    "years_experience": 9,
    "education": "Ph.D. Clinical Psychology, Tohoku University",
    "bio": "Warm and empathetic therapist specializing in depression, loneliness, and nostalgic grief. Uses interpersonal therapy to rebuild meaningful connections.",
    "price_per_session": "15,500 JPY",
    "rating": 4.8
  },
  {
    "therapist_id": "JP010",
    "name": "Shimizu Daiki",
    "location": "Yokohama, Japan",
    "languages": ["Japanese", "English"],
    "certifications": ["Licensed Clinical Psychologist (公認心理師)", "Acceptance and Commitment Therapy (ACT) Certified", "Mindfulness-Based Stress Reduction Certified"],
    "approach": ["ACT", "Mindfulness", "Values-Based Therapy"],
    "specializes_in": ["calm", "anxiety", "boredom", "values clarification", "life direction"],
    "emotions_treated": ["calm", "anxiety", "boredom", "sad"],
    "online_available": true,
    "in_person_available": true,
    "years_experience": 7,
    "education": "M.A. Psychology, Keio University",
    "bio": "Helps clients find calm and clarity through ACT and mindfulness. Specializes in helping people reconnect with their values when feeling lost or directionless.",
    "price_per_session": "12,500 JPY",
    "rating": 4.7
  }
]
$SEED$::jsonb) as t (
  therapist_id        varchar,
  name                varchar,
  location            varchar,
  languages           jsonb,
  certifications      jsonb,
  approach            jsonb,
  specializes_in      jsonb,
  emotions_treated    jsonb,
  online_available    boolean,
  in_person_available boolean,
  years_experience    int,
  education           text,
  bio                 text,
  price_per_session   varchar,
  rating              double precision
)
on conflict (therapist_id) do update set
  name                = excluded.name,
  location            = excluded.location,
  languages           = excluded.languages,
  certifications      = excluded.certifications,
  approach            = excluded.approach,
  specializes_in      = excluded.specializes_in,
  emotions_treated    = excluded.emotions_treated,
  online_available    = excluded.online_available,
  in_person_available = excluded.in_person_available,
  years_experience    = excluded.years_experience,
  education           = excluded.education,
  bio                 = excluded.bio,
  price_per_session   = excluded.price_per_session,
  rating              = excluded.rating;

-- =====================================================================
-- 7. Row-Level Security
-- =====================================================================
alter table public.profiles      enable row level security;
alter table public.diary_entries enable row level security;
alter table public.reports       enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;
alter table public.therapists    enable row level security;

drop policy if exists "profiles: self read"   on public.profiles;
drop policy if exists "profiles: self update" on public.profiles;
create policy "profiles: self read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: self update" on public.profiles for update using (auth.uid() = id);

drop policy if exists "diary: self all" on public.diary_entries;
create policy "diary: self all" on public.diary_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "report: self read"  on public.reports;
drop policy if exists "report: self write" on public.reports;
create policy "report: self read"  on public.reports
  for select using (auth.uid() = user_id);
create policy "report: self write" on public.reports
  for insert with check (auth.uid() = user_id);

drop policy if exists "conv: self all" on public.conversations;
create policy "conv: self all" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "msg: self read"  on public.messages;
drop policy if exists "msg: self write" on public.messages;
create policy "msg: self read" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );
create policy "msg: self write" on public.messages
  for insert with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

-- Therapists is a public directory — any authenticated user can read.
drop policy if exists "therapists: authenticated read" on public.therapists;
create policy "therapists: authenticated read" on public.therapists
  for select using (auth.role() = 'authenticated');
