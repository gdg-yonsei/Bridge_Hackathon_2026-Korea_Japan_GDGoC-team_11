-- Supabase initial schema + RLS.
-- Apply: Supabase Dashboard → SQL Editor → paste and Run.
-- Idempotent — safe to run multiple times (handles migration from older shape).

-- =====================================================================
-- 1. enums
-- =====================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'diary_status') then
    create type public.diary_status as enum ('pending', 'analyzing', 'done', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'emotion') then
    create type public.emotion as enum ('joy', 'sad', 'anger', 'anxiety', 'calm');
  end if;
  if not exists (select 1 from pg_type where typname = 'message_role') then
    create type public.message_role as enum ('user', 'assistant', 'system');
  end if;
end$$;

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
-- 3. diary_entries — emotion analysis and song recommendations are
--    stored inline. Each of the five emotions has its own intensity
--    column on a 1..10 scale; `primary_emotion` is the argmax computed
--    by the application after analysis.
-- =====================================================================
create table if not exists public.diary_entries (
  id                bigserial primary key,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  entry_date        date not null,
  title             varchar(200),
  content           text not null,
  status            diary_status not null default 'pending',
  primary_emotion   emotion,
  joy_intensity     int check (joy_intensity     between 1 and 10),
  sad_intensity     int check (sad_intensity     between 1 and 10),
  anger_intensity   int check (anger_intensity   between 1 and 10),
  anxiety_intensity int check (anxiety_intensity between 1 and 10),
  calm_intensity    int check (calm_intensity    between 1 and 10),
  emotion_summary   text,
  emotion_model     varchar(100),
  emotion_raw       jsonb,
  songs             jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint uq_user_entry_date unique (user_id, entry_date)
);

-- Migration: add the new columns and drop the legacy emotion_scores jsonb if present.
alter table public.diary_entries
  add column if not exists primary_emotion   emotion,
  add column if not exists joy_intensity     int,
  add column if not exists sad_intensity     int,
  add column if not exists anger_intensity   int,
  add column if not exists anxiety_intensity int,
  add column if not exists calm_intensity    int,
  add column if not exists emotion_summary   text,
  add column if not exists emotion_model     varchar(100),
  add column if not exists emotion_raw       jsonb,
  add column if not exists songs             jsonb,
  drop column if exists emotion_scores;

create index if not exists ix_diary_entries_user_id on public.diary_entries (user_id);
create index if not exists ix_diary_entries_date    on public.diary_entries (entry_date);

-- Drop legacy tables (replaced by inline columns above).
drop table if exists public.emotion_analyses     cascade;
drop table if exists public.song_recommendations cascade;

-- =====================================================================
-- 4. reports — period summaries generated on demand. Re-triggering the
--    same (user, period_start, period_end) upserts (regenerates).
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
alter table public.reports
  alter column stats set not null;

create index if not exists ix_reports_user_id on public.reports (user_id);

-- =====================================================================
-- 5. conversations + messages — CBT chatbot. Multiple conversations per
--    diary entry are allowed and `diary_entry_id` is nullable so that
--    users can also start standalone chats without picking a diary.
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
-- 6. Row-Level Security
-- =====================================================================
alter table public.profiles      enable row level security;
alter table public.diary_entries enable row level security;
alter table public.reports       enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

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
