-- Supabase 초기 스키마 + RLS.
-- 적용 방법: Supabase Dashboard → SQL Editor 에 통째로 붙여넣고 Run.
-- 멱등하게 작성해두었으니 여러 번 실행해도 안전.

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
-- 2. profiles (auth.users 와 1:1)
-- =====================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       varchar(255),
  nickname    varchar(50),
  created_at  timestamptz not null default now()
);

-- auth.users insert 시 자동으로 profiles 행 만들기 (백엔드 upsert 안 거쳐도 OK)
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
-- 6. weekly_reports
-- =====================================================================
create table if not exists public.weekly_reports (
  id                bigserial primary key,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  week_start        date not null,
  week_end          date not null,
  dominant_emotion  emotion not null,
  summary           text not null,
  mood_chart        jsonb not null,
  generated_at      timestamptz not null default now(),
  constraint uq_user_week unique (user_id, week_start)
);

create index if not exists ix_weekly_reports_user_id on public.weekly_reports (user_id);

-- =====================================================================
-- 7. Row-Level Security
--    "사용자는 자기 데이터만 본다" — 핵심 격리는 DB가 처리.
--    백엔드는 service_role 키로 우회 가능, 일반 anon/authenticated 키는 RLS 적용.
-- =====================================================================
alter table public.profiles            enable row level security;
alter table public.diary_entries       enable row level security;
alter table public.emotion_analyses    enable row level security;
alter table public.song_recommendations enable row level security;
alter table public.weekly_reports      enable row level security;

-- 본인 프로필만 read/update
drop policy if exists "profiles: self read"   on public.profiles;
drop policy if exists "profiles: self update" on public.profiles;
create policy "profiles: self read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: self update" on public.profiles for update using (auth.uid() = id);

-- 본인 일기만 CRUD
drop policy if exists "diary: self all" on public.diary_entries;
create policy "diary: self all" on public.diary_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 본인 일기의 분석/노래만 조회
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

-- 본인 주간 리포트만 조회
drop policy if exists "report: self read" on public.weekly_reports;
create policy "report: self read" on public.weekly_reports
  for select using (auth.uid() = user_id);
