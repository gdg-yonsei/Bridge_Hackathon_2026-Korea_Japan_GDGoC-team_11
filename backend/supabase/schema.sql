-- Supabase initial schema + RLS.
-- Apply: Supabase Dashboard → SQL Editor → paste and Run.
-- Idempotent — safe to run multiple times.

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

-- Auto-create a profiles row whenever a new auth.users row is inserted.
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
-- 3. diary_entries
-- =====================================================================
create table if not exists public.diary_entries (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  entry_date  date not null,
  title       varchar(200),
  content     text not null,
  status      diary_status not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint uq_user_entry_date unique (user_id, entry_date)
);

create index if not exists ix_diary_entries_user_id  on public.diary_entries (user_id);
create index if not exists ix_diary_entries_date     on public.diary_entries (entry_date);

-- =====================================================================
-- 4. emotion_analyses (1:1 with diary)
-- =====================================================================
create table if not exists public.emotion_analyses (
  id              bigserial primary key,
  entry_id        bigint not null unique references public.diary_entries(id) on delete cascade,
  primary_emotion emotion not null,
  scores          jsonb not null,
  summary         text not null,
  model_name      varchar(100),
  raw_response    jsonb,
  created_at      timestamptz not null default now()
);

-- =====================================================================
-- 5. song_recommendations (1:N)
-- =====================================================================
create table if not exists public.song_recommendations (
  id            bigserial primary key,
  entry_id      bigint not null references public.diary_entries(id) on delete cascade,
  rank          int not null,
  title         varchar(200) not null,
  artist        varchar(200) not null,
  reason        text,
  external_url  varchar(500),
  created_at    timestamptz not null default now()
);

create index if not exists ix_song_recs_entry_id on public.song_recommendations (entry_id);

-- =====================================================================
-- 6. reports — generated on demand for a given (start, end) range.
--    Re-triggering the same period upserts (regenerates) the report.
-- =====================================================================
create table if not exists public.reports (
  id                bigserial primary key,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  period_start      date not null,
  period_end        date not null,
  dominant_emotion  emotion not null,
  summary           text not null,
  mood_chart        jsonb not null,
  model_name        varchar(100),
  generated_at      timestamptz not null default now(),
  constraint uq_user_report_period unique (user_id, period_start, period_end)
);

create index if not exists ix_reports_user_id on public.reports (user_id);

-- =====================================================================
-- 7. conversations + messages — CBT chatbot (stores vLLM/CBT-Copilot results)
-- =====================================================================
create table if not exists public.conversations (
  id              bigserial primary key,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  diary_entry_id  bigint not null unique references public.diary_entries(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists ix_conversations_user_id on public.conversations (user_id);

do $$
begin
  if not exists (select 1 from pg_type where typname = 'message_role') then
    create type public.message_role as enum ('user', 'assistant', 'system');
  end if;
end$$;

create table if not exists public.messages (
  id              bigserial primary key,
  conversation_id bigint not null references public.conversations(id) on delete cascade,
  role            message_role not null,
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists ix_messages_conversation_id on public.messages (conversation_id);

-- =====================================================================
-- 8. Row-Level Security
--    Users see only their own data — isolation enforced at the DB level.
--    Backend can bypass with the service_role key; anon/authenticated keys respect RLS.
-- =====================================================================
alter table public.profiles             enable row level security;
alter table public.diary_entries        enable row level security;
alter table public.emotion_analyses     enable row level security;
alter table public.song_recommendations enable row level security;
alter table public.reports              enable row level security;
alter table public.conversations        enable row level security;
alter table public.messages             enable row level security;

-- Own profile: read/update only
drop policy if exists "profiles: self read"   on public.profiles;
drop policy if exists "profiles: self update" on public.profiles;
create policy "profiles: self read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: self update" on public.profiles for update using (auth.uid() = id);

-- Own diary entries: full CRUD
drop policy if exists "diary: self all" on public.diary_entries;
create policy "diary: self all" on public.diary_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Own diary analyses/songs: read only
drop policy if exists "analysis: self read" on public.emotion_analyses;
create policy "analysis: self read" on public.emotion_analyses
  for select using (
    exists (
      select 1 from public.diary_entries d
      where d.id = entry_id and d.user_id = auth.uid()
    )
  );

drop policy if exists "songs: self read" on public.song_recommendations;
create policy "songs: self read" on public.song_recommendations
  for select using (
    exists (
      select 1 from public.diary_entries d
      where d.id = entry_id and d.user_id = auth.uid()
    )
  );

-- Own reports: read/insert
drop policy if exists "report: self read"  on public.reports;
drop policy if exists "report: self write" on public.reports;
create policy "report: self read"  on public.reports
  for select using (auth.uid() = user_id);
create policy "report: self write" on public.reports
  for insert with check (auth.uid() = user_id);

-- Own conversations: full CRUD
drop policy if exists "conv: self all" on public.conversations;
create policy "conv: self all" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Messages: read/write only when the parent conversation belongs to the user
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
