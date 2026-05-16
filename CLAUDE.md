# CLAUDE.md

This file contains the project context and rules Claude Code must follow when working in this repository.

## Project Overview

- **Name**: TBD (Bridge Hackathon 2026 · Korea·Japan GDGoC Team 1)
- **Domain**: Emotion diary — users write diary entries, the backend classifies emotions with Gemini across 9 emotions (float 0-1 per emotion), displays them on a calendar, runs the **Solis** chatbot for reflective conversations, generates period reports, and matches users to therapists from a curated directory.
- **Detailed design**: See [PLAN.md](PLAN.md) for the original data model and frontend page structure (now partially superseded — see "Domain Model Summary" below).

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI · SQLAlchemy 2.0 · Pydantic v2 |
| LLM (everything) | **Gemini API** (`gemini-2.5-flash`) — chatbot · emotion classification · period reports · therapist matching |
| DB · Auth | **Supabase** (Postgres + Auth + Realtime) |
| Rate limiting | `slowapi` (in-memory, keyed by token tail or IP) |
| Language | **English** (all user input and prompts) |
| Frontend | Next.js 14 (App Router) · TypeScript · TailwindCSS · `@supabase/supabase-js` |
| Infra | Docker · uv (Python dependency management) |

## Domain Model Summary

```
auth.users ── public.profiles ── diary_entries (emotion analysis + Solis fields + songs inlined)
                              ├─ reports
                              └─ conversations ── messages
                public.therapists  (read-only directory, seeded in schema.sql)
```

- **Emotion analysis lives directly on `diary_entries`**:
  - `scores jsonb` carries all 9 emotions as **floats in [0, 1]**: `joy, sad, anger, anxiety, calm, embarrassment, envy, boredom, nostalgia`
  - `primary_emotion` is the argmax (computed by Gemini, stored as enum)
  - Solis response: `solis_message`, `suggested_action`, `crisis_score float`, `needs_hotline bool`
  - Diagnostics: `emotion_summary`, `emotion_model`, `emotion_raw jsonb`
  - There is **no separate `emotion_analyses` table**
- A safety net of English crisis-keyword matching in [diary_analysis_service.py](backend/app/services/diary_analysis_service.py) overrides `needs_hotline=true` regardless of model output when 1st-person crisis phrases are detected.
- Song recommendations live in a `songs jsonb` column on `diary_entries`. Generation is **not implemented** — the column stays `NULL`.
- A diary entry can have **multiple** conversations, and `conversations.diary_entry_id` is **nullable** so users can start a chat without binding it to a diary.
- Period reports include a `stats jsonb` column with `{emotion: {avg, peak, days}}` (avg/peak are **floats now**, not ints). `mood_chart`, `stats`, and `dominant_emotion` are computed app-side from the entries (Gemini only writes the narrative `summary`).
- **`therapists`** is a public directory (20 seeded therapists for KR + JP). RLS allows authenticated read for all users. The matcher does a 2-layer rank: mathematical filter (emotion overlap + concern keyword overlap + online availability) → Gemini semantic re-rank via `response_schema=TherapistRankingList`.

## Directory Conventions

- `backend/app/core/enums.py` — Shared domain enums (`DiaryStatus`, `Emotion` (9 values), `MessageRole`, `EMOTIONS` tuple); imported by both entity and models layers
- `backend/app/core/rate_limit.py` — slowapi `limiter` keyed by Bearer token tail (or IP fallback)
- `backend/app/entity/` — SQLAlchemy ORM classes (DB mapping)
- `backend/app/models/` — Pydantic schemas (API DTOs)
- `backend/app/repository/` — ORM-based CRUD abstraction
- `backend/app/services/` — Business logic, external APIs, LLM calls (background jobs live here too — analysis trigger is a `BackgroundTasks` call into `services/diary_analysis_service.py`)
- `backend/app/services/prompts.py` — Centralised LLM system prompts (`CLASSIFY_EMOTION_SYSTEM`, `SOLIS_CHAT_SYSTEM`, `THERAPIST_SUMMARY_SYSTEM`, `THERAPIST_MATCH_SYSTEM`)
- `backend/app/api/` — HTTP routing (keep thin)
- `backend/scripts/smoke.sh` — End-to-end curl smoke test for the deployed backend

## Supabase Rules

- **Sign-up / login is handled entirely by the frontend** via `@supabase/supabase-js`. The backend never touches passwords (no `/auth/signup` or `/auth/login` endpoints).
- The frontend passes the Supabase `access_token` as `Authorization: Bearer <token>` to the backend.
- The backend verifies the JWT in [core/security.py](backend/app/core/security.py) by fetching JWKS from `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` and validating ES256 signatures. HS256 + `SUPABASE_JWT_SECRET` is retained only as a fallback for legacy tokens.
- After verification, [core/dependencies.py](backend/app/core/dependencies.py) `get_current_user` upserts a `public.profiles` row — same PK as `auth.users.id` (UUID).
- All `user_id` fields are **UUID** (not integer). entity / repository / route signatures must all use UUID.
- **Row-Level Security (RLS)** is enabled on all user data tables. The backend connects with credentials that bypass RLS, so the in-router `entry.user_id != user.id` checks are the **primary** boundary; RLS is defense-in-depth for any client that connects via PostgREST.
- The service role key (`SUPABASE_SERVICE_ROLE_KEY`) is held by the backend only — never expose it to the frontend or commit it to git.

## Work Rules (must follow)

### ❌ Linear is forbidden

**Never create anything in Linear.** No issues, projects, branches, comments, labels, or cycles. No workarounds via external APIs or MCP tools.

- Never call `mcp__claude_ai_Linear__save_*` or `create_*` tools
- Always create branches locally with `git checkout -b ...`
- Do not attempt any write operation in Linear unless the user **explicitly** requests it
- Even read-only calls (`get_*`, `list_*`) are only allowed when the user asks first

### Dependencies & Environment

- Python dependencies: `backend/pyproject.toml` + `uv` only (no direct `pip`)
- Add a dependency: `cd backend && uv add <pkg>` / dev: `uv add --dev <pkg>`
- Run the server: `cd backend && uv run uvicorn app.main:app --reload`
- Commit `uv.lock` whenever dependencies change

### Code Style

- Backend format & lint: `uv run ruff format . && uv run ruff check --fix .`
- Functions & variables: `snake_case`; classes: `PascalCase` (Python)
- TypeScript: camelCase; components: PascalCase; filenames: kebab-case
- Comments: write the *why* only — never the *what* (the code already says that)

### LLM Call Rules

- All LLM calls must go through the service layer (`services/`)
- Never call LLMs directly from routers (`api/`)
- **Structured outputs must enforce a JSON schema** via `response_schema=<PydanticModel>` on `GenerateContentConfig` (or vLLM `guided_json` if we ever bring that back). Never hand-strip ` ```json ` fences. Validate the parsed Pydantic object, then persist.

### Async Processing

- Diary analysis is always async (`POST /diary` returns `202` immediately; analysis runs in the background via `BackgroundTasks`)
- Never block the request thread on LLM calls — except `/reports`, `/conversations/{id}/messages`, and `/therapist/match` which are documented as synchronous Gemini calls (rate-limited)

### Rate Limiting

- Add `@limiter.limit("...")` (from [core/rate_limit.py](backend/app/core/rate_limit.py)) on endpoints that hit Gemini. Current budget: `/reports` 20/hour, `/therapist/match` 10/hour.
- The decorator needs `request: Request` as the first parameter of the endpoint function.

## Decided

| # | Item | Decision |
|---|---|---|
| - | All LLM calls | **Gemini API** (`gemini-2.5-flash`) — single provider for chatbot, classification, reports, matching |
| 4 | Analysis trigger | **`BackgroundTasks`** (swap to Celery/Edge Function by modifying `services/diary_analysis_service.py` only) |
| 8 | Auth | **Supabase Auth** (custom JWT removed) |
| - | DB | **Supabase Postgres** (local DB container removed) |
| - | Language | **English** (all user input / prompts) |
| - | Emotions | **9 emotions, float 0-1**: joy, sad, anger, anxiety, calm, embarrassment, envy, boredom, nostalgia |
| - | Chatbot persona | **Solis** (warm, non-clinical) |
| - | Therapists | **Inline DB table** seeded in `schema.sql` (20 KR + JP profiles). No external JSON file. |
| - | Rate limit backend | `slowapi` in-memory (single-worker). Swap to Redis if scaling out |

## Pending Decisions

1. Song recommendations data source (LLM text / Spotify / YouTube)
2. Real-time analysis progress delivery (polling / SSE / **Supabase Realtime** preferred)
3. Re-analysis policy when a diary entry is edited (currently: clear + re-trigger; no in-progress check)
4. Multi-worker rate limit storage (Redis vs in-memory single worker)

## Quick Command Reference

```bash
make backend   # build + run + stream logs
make down      # stop server
./backend/scripts/smoke.sh   # end-to-end check against API_BASE
```
