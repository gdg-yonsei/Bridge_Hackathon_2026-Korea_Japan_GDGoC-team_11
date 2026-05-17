# Backend

FastAPI · SQLAlchemy 2.0 · Pydantic v2 · Supabase (Postgres + Auth + RLS) ·
Gemini · Spotify · Cloud Run.

> All emotion classification, the Solis chatbot, period reports, therapist
> matching, and song suggestion run through one provider — **Gemini API**.
> Spotify resolves song picks to playable URLs. Supabase is the source of
> truth for auth, profiles, diary entries, conversations, reports, and the
> therapist directory.
>
> See [../README.md](../README.md) for the product overview.

---

## Live deployment

- **Base URL**: https://my-app-486682024571.asia-northeast3.run.app
- Swagger: [`/docs`](https://my-app-486682024571.asia-northeast3.run.app/docs)
- OpenAPI JSON: `/openapi.json`
- Health: `/health` (no auth)
- Region: `asia-northeast3` (Seoul, Cloud Run)
- Image registry: `asia-northeast3-docker.pkg.dev/quantum-feat-467404-s1/backend-server/my-app`

---

## Quick start

### 1. Supabase setup (one-time)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → SQL Editor
2. Paste [supabase/schema.sql](supabase/schema.sql) → **Run**. Idempotent — safe to re-run; handles migration from older shapes and seeds the therapists table on every run.
3. Copy from Settings → API:
   - Project URL → `SUPABASE_URL`
   - publishable key (`sb_publishable_...`) → `SUPABASE_ANON_KEY`
   - secret key (`sb_secret_...`) → `SUPABASE_SERVICE_ROLE_KEY`
4. Settings → Database → Connection string → **Session/Transaction Pooler** URI → `DATABASE_URL`
   - swap `postgresql://` → `postgresql+psycopg2://`
   - append `?sslmode=require`

> New Supabase projects sign JWTs with ECC P-256 (ES256). [core/security.py](app/core/security.py) fetches JWKS from `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` and verifies against the matching `kid`. `SUPABASE_JWT_SECRET` is kept as a legacy HS256 fallback only — usually left empty.

### 2. Local development

```bash
cd backend
cp .env.example .env          # fill in values
uv sync
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or via Docker:

```bash
make backend                  # from repo root — build + run + tail logs
make down                     # stop
```

- API: http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- OpenAPI JSON: http://localhost:8000/openapi.json

### 3. Get a JWT (frontend or curl)

Login is handled by Supabase Auth directly — the backend never touches passwords.

```bash
# sign up
curl -X POST "$SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"..."}'

# log in
curl -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"..."}'
# → { "access_token": "...", ... }
```

Use the `access_token` as `Authorization: Bearer <token>` for every backend call.

### 4. Smoke test after deploy

```bash
export API_BASE=https://my-app-486682024571.asia-northeast3.run.app
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_ANON_KEY=sb_publishable_...
export TEST_EMAIL=... TEST_PASSWORD=...
./scripts/smoke.sh
```

Walks `/health` → login → `/auth/me` → `/diary/preview` → `/diary` → analysis polling → `/conversations` → `/messages` → `/reports` → `/therapist/match`. 10 ticks = pass.

---

## Environment variables

`.env` is read by `pydantic-settings`; missing optional vars fall back to defaults documented in [core/config.py](app/core/config.py).

### Required

| Var | Used for | Notes |
|---|---|---|
| `SUPABASE_URL` | JWKS fetch + token audience | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend admin operations | Never expose to frontend |
| `DATABASE_URL` | SQLAlchemy engine | `postgresql+psycopg2://...?sslmode=require` |
| `GEMINI_API_KEY` *or* `GEMINI_API_KEYS` | All LLM calls | At least one required. See "Gemini key pool" below |

### Optional

| Var | Default | Notes |
|---|---|---|
| `SUPABASE_ANON_KEY` | `""` | Frontend-side, backend rarely needs it |
| `SUPABASE_JWT_SECRET` | `""` | Legacy HS256 fallback only |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Primary model |
| `GEMINI_FALLBACK_MODEL` | `gemini-2.0-flash` | Used on 429 from primary; set to `""` to disable fallback |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | `""` | If unset, song recommendation degrades gracefully — emotion analysis still works |
| `CORS_ORIGINS` | `*` | Comma-separated list for production |
| `LOG_LEVEL` | `INFO` | Standard Python logging level |

### Gemini key pool

The effective key pool is `GEMINI_API_KEY` (single, prepended first) ∪ `GEMINI_API_KEYS` (comma-separated), deduped, order-preserving. Every call to `get_gemini_client()` rotates to the next key. Combined with the model-fallback retry, a single user request sees up to **2 keys × 2 models = 4 distinct {key, model} pairs** before failing.

---

## API reference

> All user-data endpoints require `Authorization: Bearer <supabase access_token>`.
> Rate-limited endpoints additionally need the `Request` object as the first
> parameter (FastAPI requirement for slowapi). Limits are keyed by the last
> 24 characters of the Bearer token, so they're per-user.

### Common status codes

| Status | When |
|---|---|
| `401 Unauthorized` | Missing / expired / invalid token |
| `404 Not Found` | Resource missing or not owned by caller |
| `409 Conflict` | Duplicate (e.g. diary already exists for that date) |
| `422 Unprocessable Entity` | Pydantic validation failed |
| `429 Too Many Requests` | Rate limit exceeded |
| `502 Bad Gateway` | Gemini / Spotify upstream failure |

### Endpoint inventory

| Method | Path | Auth | Rate limit |
|---|---|:-:|:-:|
| `GET` | `/health` | — | — |
| `GET` | `/auth/me` | ✓ | — |
| `PATCH` | `/auth/me` | ✓ | — |
| `POST` | `/diary` | ✓ | — |
| `GET` | `/diary?year=YYYY&month=M` | ✓ | — |
| `GET` | `/diary/{entry_id}` | ✓ | — |
| `PUT` | `/diary/{entry_id}` | ✓ | — |
| `DELETE` | `/diary/{entry_id}` | ✓ | — |
| `POST` | `/diary/preview` | ✓ | 200/hour |
| `POST` | `/diary/{entry_id}/reanalyze` | ✓ | — |
| `GET` | `/conversations` | ✓ | — |
| `POST` | `/conversations` | ✓ | — |
| `GET` | `/conversations/{conversation_id}` | ✓ | — |
| `POST` | `/conversations/{conversation_id}/messages` | ✓ | — |
| `DELETE` | `/conversations/{conversation_id}` | ✓ | — |
| `POST` | `/reports` | ✓ | 20/hour |
| `GET` | `/therapist` | ✓ | 60/hour |
| `POST` | `/therapist/match` | ✓ | 10/hour |
| `GET` | `/songs/search?q=...` | ✓ | 60/hour |

### Diary

#### `POST /diary` — create entry

Returns `202` immediately; emotion analysis runs in a background task. Conflicts if an entry already exists for that date.

**Request** — `DiaryCreate`
```json
{ "entry_date": "2026-05-17", "title": "Today was odd", "content": "I felt anxious in the morning but calmer after a walk." }
```

**Response 202** — `DiaryAccepted`
```json
{ "entry_id": 42, "entry_date": "2026-05-17", "status": "pending" }
```

#### `POST /diary/preview` — live emotion read

Lightweight Gemini call, **no DB write**. Used by the frontend to render emotion bars while the user is still typing. Frontend should debounce (~800 ms).

**Request** — `LivePreviewRequest`
```json
{ "content": "오늘 발표 끝나고 든든했어." }
```

**Response 200** — `LiveEmotionResult`
```json
{
  "primary_emotion": "comfort",
  "scores": { "joy": 0.5, "calm": 0.4, "comfort": 0.8, "sad": 0.0, "anxious": 0.2, "angry": 0.0 }
}
```

#### `GET /diary?year=2026&month=5` — calendar view

**Response 200** — `list[DiaryListItem]`
```json
[
  { "entry_id": 1, "entry_date": "2026-05-01", "primary_emotion": "calm", "status": "done" },
  { "entry_id": 2, "entry_date": "2026-05-17", "primary_emotion": null,   "status": "analyzing" }
]
```

#### `GET /diary/{entry_id}` — full detail

**Response 200** — `DiaryDetail`
```json
{
  "id": 42,
  "entry_date": "2026-05-17",
  "title": "Today was odd",
  "content": "I felt anxious in the morning but calmer after a walk.",
  "status": "done",
  "primary_emotion": "calm",
  "scores": {
    "joy": 0.2, "calm": 0.7, "comfort": 0.3,
    "sad": 0.0, "anxious": 0.5, "angry": 0.0
  },
  "emotion_summary": "An anxious morning settled into a calmer afternoon.",
  "crisis_score": 0.1,
  "solis_message": "It sounds like the walk gave you a way to come back to yourself.",
  "suggested_action": "Try a 5-minute morning breathing exercise tomorrow.",
  "needs_hotline": false,
  "songs": [
    {
      "rank": 1,
      "title": "Bloom",
      "artist": "The Paper Kites",
      "reason": "Settled and reflective — matches the way your afternoon felt.",
      "preview_url": "https://p.scdn.co/mp3-preview/...",
      "external_url": "https://open.spotify.com/track/..."
    }
  ],
  "created_at": "2026-05-17T10:31:44Z",
  "updated_at": "2026-05-17T10:31:48Z"
}
```

- `scores` is `null` while `status` is `pending`/`analyzing`/`failed`; populated with all 6 emotions once `status=done`.
- `primary_emotion` is Gemini's argmax (stored as enum).
- `crisis_score` is 0–1; `needs_hotline` flips true at ≥0.8 or when a 1st-person English crisis keyword matches.
- `songs` is `[]` when Spotify is unconfigured or no match resolved; otherwise a single-element array.

#### `PUT /diary/{entry_id}` — edit

Editing `content` clears the prior analysis, resets `status=pending`, and re-triggers the background task. Editing only `title` does not retrigger analysis.

**Request** — `DiaryUpdate` (both fields optional)
**Response 200** — `DiaryAccepted`

#### `DELETE /diary/{entry_id}` — 204

Idempotent if the entry is missing or not owned.

#### `POST /diary/{entry_id}/reanalyze` — 202 manual re-run

### Conversations (Solis chatbot)

#### `POST /conversations` — start a session

`diary_entry_id` may be `null` for a standalone chat.

**Request** — `ConversationCreate`
```json
{ "diary_entry_id": 42, "title": null }
```

#### `GET /conversations?diary_id=42` — list

Optional `diary_id` query filters to a single diary's conversations.

#### `GET /conversations/{id}` — full history

**Response 200** — `ConversationDetail` with embedded `messages`.

#### `POST /conversations/{id}/messages` — send a message

Synchronous Gemini call (1–3 s typical). Both the user message and assistant reply are persisted.

**Request** — `{ "message": "..." }`
**Response 200** — `ChatTurnResponse`
```json
{
  "user_message":      { "role": "user",      "content": "...", "created_at": "..." },
  "assistant_message": { "role": "assistant", "content": "...", "created_at": "..." }
}
```

#### `DELETE /conversations/{id}` — 204 (idempotent)

### Reports

#### `POST /reports` — period report

`mood_chart`, `stats`, and `dominant_emotion` are computed app-side from analysed entries — Gemini only writes the narrative `summary`. Same `(user, period_start, period_end)` is upsert.

**Request** — `ReportCreate`
```json
{ "period_start": "2026-05-11", "period_end": "2026-05-17" }
```

**Response 200** — `ReportOut`
```json
{
  "period_start": "2026-05-11",
  "period_end":   "2026-05-17",
  "dominant_emotion": "calm",
  "summary": "You navigated a tense Monday and gradually found steadier ground...",
  "mood_chart": {
    "2026-05-11": { "joy": 0.3, "calm": 0.4, "comfort": 0.2, "sad": 0.6, "anxious": 0.7, "angry": 0.1 },
    "2026-05-12": { "joy": 0.5, "calm": 0.7, "comfort": 0.4, "sad": 0.2, "anxious": 0.3, "angry": 0.0 }
  },
  "stats": {
    "joy":     { "avg": 0.4, "peak": 0.7, "days": 1 },
    "calm":    { "avg": 0.55, "peak": 0.8, "days": 4 },
    "comfort": { "avg": 0.3, "peak": 0.6, "days": 0 },
    "sad":     { "avg": 0.4, "peak": 0.7, "days": 1 },
    "anxious": { "avg": 0.5, "peak": 0.7, "days": 1 },
    "angry":   { "avg": 0.05, "peak": 0.1, "days": 0 }
  },
  "model_name": "gemini-2.5-flash",
  "generated_at": "..."
}
```

`stats.<emotion>.days` counts diary entries where this emotion was the `primary_emotion`.

### Therapists

#### `GET /therapist` — filterable directory read

Query params (all optional, AND-combined):

| Param | Example | Behavior |
|---|---|---|
| `country` | `Korea` / `Japan` | `location` suffix match |
| `language` | `korean` / `japanese` / `english` | JSONB contains in `languages` (input is title-cased) |
| `concern` | `anxiety` | JSONB contains in `specializes_in` (input is lowercased) |
| `emotion` | `sad` | JSONB contains in `emotions_treated` |
| `online` | `true` / `false` | exact match |
| `in_person` | `true` / `false` | exact match |
| `min_rating` | `4.7` | `rating >= min_rating` |

**Response 200** — `list[TherapistProfile]`.

#### `POST /therapist/match` — 2-layer ranked match

**Request** — `TherapistMatchRequest`
```json
{
  "therapist_summary": {
    "summary_for_therapist": "User reports morning anxiety that eases with movement.",
    "key_concerns": ["anxiety", "workplace stress"],
    "emotion_pattern": "anxiety peaks AM, calms PM",
    "suggested_focus_areas": ["anxiety regulation"],
    "crisis_indicators": "none detected",
    "user_strengths": "self-aware, takes walks"
  },
  "user_emotions": {
    "joy": 0.2, "calm": 0.4, "comfort": 0.3,
    "sad": 0.1, "anxious": 0.7, "angry": 0.0
  },
  "language": "both"
}
```

`language` ∈ `"korean"`, `"japanese"`, `"both"` (default).

**Response 200** — `TherapistMatchResponse`
```json
{
  "top_matches": [
    {
      "therapist_id": "KR001",
      "name": "Dr. Kim Soo-Yeon",
      "location": "Seoul, Korea",
      "languages": ["Korean", "English"],
      "specializes_in": ["anxiety", "workplace stress"],
      "emotions_treated": ["anxious", "angry", "sad"],
      "online_available": true,
      "match_score": 0.94,
      "match_reason": "Specializes in workplace anxiety in Korean corporate culture.",
      "matched_concerns": ["anxiety", "workplace stress"],
      "approach_fit": "CBT plus mindfulness fits the user's pattern of physical regulation."
    }
  ],
  "total_candidates_evaluated": 20,
  "layer1_filtered": 5,
  "matching_method": "two-layer: mathematical + AI semantic"
}
```

### Songs

#### `GET /songs/search?q=...` — standalone Spotify lookup

Resolves any free-form query to one Spotify track (prefers tracks with a `preview_url`). Returns 404 if no hits, 502 if Spotify creds are missing.

**Response 200** — `SongOut`
```json
{
  "rank": 1,
  "title": "Bloom",
  "artist": "The Paper Kites",
  "reason": null,
  "preview_url": "https://p.scdn.co/mp3-preview/...",
  "external_url": "https://open.spotify.com/track/..."
}
```

Frontend usage:
- `expo-av` `Audio.Sound` → play `preview_url` (30 s, no auth needed)
- `Linking.openURL(external_url)` → open in Spotify app (full track, Premium-gated)

### Auth

#### `GET /auth/me` — current profile

On first call after sign-up, this upserts a `profiles` row keyed by `auth.users.id`.

**Response 200** — `UserOut`
```json
{ "id": "uuid-...", "email": "you@example.com", "nickname": null, "created_at": "..." }
```

#### `PATCH /auth/me` — update profile

**Request** — `{ "nickname": "alice" }` (only nickname supported today)
**Response 200** — `UserOut`

---

## Data model

### Pydantic DTOs

| Schema | Location | Used for |
|---|---|---|
| `UserOut`, `ProfileUpdate` | [models/user.py](app/models/user.py) | `/auth/me` |
| `DiaryCreate`, `DiaryUpdate`, `DiaryAccepted`, `DiaryListItem`, `DiaryDetail`, `SongOut`, `EmotionScores` | [models/diary.py](app/models/diary.py) | `/diary/*` |
| `DiaryAnalysisLLMResult` | 〃 | Gemini structured output for full analysis |
| `LivePreviewRequest`, `LiveEmotionResult` | 〃 | `/diary/preview` |
| `ChatMessageIn`, `MessageOut`, `ChatTurnResponse`, `ConversationCreate`, `ConversationSummary`, `ConversationDetail` | [models/chat.py](app/models/chat.py) | Conversations |
| `ReportCreate`, `ReportOut`, `EmotionStat`, `ReportLLMResult` | [models/report.py](app/models/report.py) | Reports |
| `TherapistMatchRequest`, `TherapistMatchResponse`, `TherapistSummary`, `TherapistProfile`, `TherapistMatch`, `TherapistRanking`, `TherapistRankingList` | [models/therapist.py](app/models/therapist.py) | `/therapist/*` |

### Enums ([app/core/enums.py](app/core/enums.py))

- `DiaryStatus`: `pending · analyzing · done · failed`
- `Emotion` (6): `joy · calm · comfort · sad · anxious · angry`
- `MessageRole`: `user · assistant · system`
- `EMOTIONS` — tuple of the 6 emotion strings, used by reports & song service

### Tables

```
auth.users  (Supabase managed)
   │ id (uuid)
   │  ON INSERT → trigger handle_new_user()
   ▼
public.profiles
   │ id (uuid, PK, FK → auth.users.id ON DELETE CASCADE)
   │ email · nickname · created_at
   │
   ├──< public.diary_entries
   │      │ id (bigserial PK), user_id, entry_date, title, content, status
   │      │ primary_emotion (emotion enum) · scores (jsonb)
   │      │ emotion_summary · emotion_model · emotion_raw (jsonb)
   │      │ crisis_score (double) · solis_message · suggested_action
   │      │ needs_hotline (bool NOT NULL default false)
   │      │ songs (jsonb) · created_at · updated_at
   │      │ UNIQUE (user_id, entry_date)
   │
   ├──< public.conversations  (diary_entry_id NULLABLE → standalone chats allowed)
   │      │ id · user_id · diary_entry_id (nullable FK) · title · timestamps
   │      │
   │      └──< public.messages
   │            │ conversation_id (FK) · role (message_role enum) · content · created_at
   │
   └──< public.reports
          │ user_id · period_start · period_end · dominant_emotion · summary
          │ mood_chart (jsonb) · stats (jsonb) · model_name · generated_at
          │ UNIQUE (user_id, period_start, period_end)

public.therapists  (read-only directory, no FK)
   │ therapist_id (varchar PK) · name · location
   │ languages · certifications · approach · specializes_in · emotions_treated  (all jsonb arrays)
   │ online_available · in_person_available · years_experience · education · bio
   │ price_per_session · rating
   │ Seeded with 20 profiles inline in schema.sql (jsonb_to_recordset + ON CONFLICT DO UPDATE)
```

### Row-Level Security

RLS is enabled on every user-owned table. The backend connects with DB-owner credentials and effectively bypasses RLS, so the in-router `entry.user_id != user.id` check is the **primary** boundary; RLS is defense-in-depth for any client that connects via PostgREST.

| Policy | Table | Operation | Rule |
|---|---|---|---|
| `profiles: self read/update` | `profiles` | SELECT/UPDATE | `auth.uid() = id` |
| `diary: self all` | `diary_entries` | ALL | `auth.uid() = user_id` |
| `report: self read/write` | `reports` | SELECT/INSERT | `auth.uid() = user_id` |
| `conv: self all` | `conversations` | ALL | `auth.uid() = user_id` |
| `msg: self read/write` | `messages` | SELECT/INSERT | parent conversation's `user_id = auth.uid()` |
| `therapists: authenticated read` | `therapists` | SELECT | `auth.role() = 'authenticated'` |

---

## Architectural rules

### LLM calls

- All LLM calls live in `app/services/` — never in `app/api/` routers.
- Structured outputs must use `response_schema=<PydanticModel>` on `GenerateContentConfig`. Never hand-strip ` ```json ` fences.
- Use `generate_with_fallback(contents=..., config=...)` from [core/gemini_client.py](app/core/gemini_client.py) — it handles the model fallback transparently.

### Background processing

- `POST /diary` returns 202 immediately; emotion analysis + song recommendation run in a `BackgroundTask` (own DB session, own lifecycle).
- The background path retries Gemini up to 3 times with jittered exponential backoff (~1.5 s → 3 s → 6 s).
- Synchronous LLM-bound endpoints (`/reports`, `/conversations/{id}/messages`, `/therapist/match`, `/diary/preview`) call Gemini inline and are rate-limited.

### Rate limiting

slowapi with the default in-memory backend. Single uvicorn worker keeps the counter consistent. Switch the storage URI to Redis if scaling to multiple workers.

Keying logic in [core/rate_limit.py](app/core/rate_limit.py): the last 24 characters of the Bearer token if present, else `get_remote_address(request)`.

### Resilience layers (Gemini)

| Layer | Where | Behavior |
|---|---|---|
| Key round-robin | `get_gemini_client()` | Each call picks the next key from the dedup pool |
| Model fallback | `generate_with_fallback()` | On 429 / RESOURCE_EXHAUSTED, retry against `gemini_fallback_model` (also rotates to next key) |
| Background retry | `_call_gemini_with_retry()` | 3 attempts with exponential backoff for `trigger_analysis` |

---

## Directory layout

```
backend/
├── app/
│   ├── main.py                       # FastAPI app, routers, CORS, rate limit, logging
│   ├── api/
│   │   ├── auth.py                   # /auth/me
│   │   ├── diary.py                  # /diary, /diary/preview, /diary/{id}/reanalyze
│   │   ├── chat.py                   # /conversations/*
│   │   ├── report.py                 # /reports (rate-limited)
│   │   ├── therapist.py              # /therapist, /therapist/match (rate-limited)
│   │   └── song.py                   # /songs/search (rate-limited)
│   ├── core/
│   │   ├── config.py                 # Pydantic Settings (.env)
│   │   ├── dependencies.py           # get_db, get_current_user
│   │   ├── enums.py                  # DiaryStatus · Emotion(6) · MessageRole · EMOTIONS
│   │   ├── security.py               # JWKS + ES256 verification (HS256 fallback)
│   │   ├── gemini_client.py          # round-robin key pool + model fallback
│   │   ├── spotify_client.py         # Client Credentials Flow + thread-safe token cache
│   │   └── rate_limit.py             # slowapi limiter (token tail or IP)
│   ├── db/
│   │   ├── database.py               # Lazy SQLAlchemy engine + SessionLocal
│   │   └── init_db.py                # create_all (production uses schema.sql)
│   ├── entity/
│   │   ├── base_entity.py
│   │   ├── user_entity.py            # profiles
│   │   ├── diary_entry_entity.py     # scores jsonb + crisis/Solis fields + songs jsonb
│   │   ├── conversation_entity.py    # diary_entry_id nullable, title
│   │   ├── message_entity.py
│   │   ├── report_entity.py          # mood_chart + stats jsonb
│   │   └── therapist_entity.py       # jsonb-array directory entry
│   ├── models/                       # Pydantic DTOs (see "Data model" above)
│   ├── repository/
│   │   ├── base_repo.py
│   │   ├── user_repo.py              # upsert_from_supabase
│   │   ├── diary_repo.py             # save_analysis, clear_analysis
│   │   ├── conversation_repo.py      # list_for_user, create
│   │   ├── report_repo.py            # upsert (regenerate same period)
│   │   └── therapist_repo.py         # list_all, list_by_location_suffix, filter()
│   └── services/
│       ├── prompts.py                # All LLM system prompts
│       ├── diary_analysis_service.py # background analysis + live_classify + crisis safety net
│       ├── chatbot_service.py        # Solis multi-turn Gemini
│       ├── report_service.py         # app-side aggregation + Gemini narrative
│       ├── therapist_service.py      # 2-layer matcher (math + Gemini response_schema)
│       └── song_service.py           # Gemini → Spotify popularity filter → 1 pick
├── scripts/
│   └── smoke.sh                      # end-to-end curl verification
├── supabase/
│   └── schema.sql                    # idempotent migration + enums + RLS + therapists seed
├── .env.example
├── Dockerfile                        # uv multi-stage, exec uvicorn ${PORT:-8000}
└── pyproject.toml
```

---

## Common commands

```bash
uv sync                                  # install deps from lockfile
uv run uvicorn app.main:app --reload     # dev server
uv run ruff format . && uv run ruff check --fix .
uv add <package>                         # add runtime dep
uv add --dev <package>                   # add dev dep
./scripts/smoke.sh                       # post-deploy verification
make deploy                              # build + push + Cloud Run redeploy
make deploy-run                          # redeploy same image (env-only changes)
```

---

## Not yet implemented

- [x] Gemini emotion classification (6 emotions, float `[0, 1]`)
- [x] Solis multi-turn chatbot (Gemini)
- [x] Period reports (app-side stats + Gemini narrative)
- [x] Therapist matching (2-layer math + Gemini)
- [x] Live emotion preview (`/diary/preview`)
- [x] Song recommendation (Gemini → Spotify popularity floor)
- [x] Crisis safety net (Gemini `crisis_score` + 1st-person keyword override)
- [x] Multi-key Gemini pool + model fallback + background retry
- [x] Cloud Run deploy + smoke test
- [ ] Realtime analysis progress (currently polled; Supabase Realtime under review)
- [ ] Korean / Japanese crisis keyword expansion (English only today)
- [ ] Multi-worker rate-limit storage (Redis), needed if we scale beyond 1 uvicorn worker
