# CLAUDE.md

This file contains the project context and rules Claude Code must follow when working in this repository.

## Project Overview

- **Name**: TBD (Bridge Hackathon 2026 · Korea·Japan GDGoC Team 1)
- **Domain**: Emotion diary — users write diary entries, the backend classifies emotions with Gemini, displays them on a calendar with colour coding, and auto-generates summaries, song recommendations, and period reports.
- **Detailed design**: See [PLAN.md](PLAN.md) for the data model, LangGraph setup, API endpoints, and frontend page structure.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI · SQLAlchemy 2.0 · Pydantic v2 · LangGraph |
| LLM (chatbot) | **CBT-Copilot** (`thillaic/CBT-Copilot`, Llama-3.2-3B-Instruct LoRA) via vLLM |
| LLM (reports) | **Gemini API** (`gemini-2.5-flash`) |
| LLM (emotion classification) | **Gemini API** (`gemini-2.5-flash`) |
| DB · Auth | **Supabase** (Postgres + Auth + Realtime) |
| Language | **English** (all user input and prompts) |
| Frontend | Next.js 14 (App Router) · TypeScript · TailwindCSS · `@supabase/supabase-js` |
| Infra | Docker Compose · uv (Python dependency management) |

## Domain Model Summary

```
auth.users ── public.profiles ── diary_entries (emotion analysis + songs inlined as JSONB)
                              ├─ reports
                              └─ conversations ── messages
```

- Emotion analysis lives directly on `diary_entries`: one `int` column per emotion (`joy_intensity`, `sad_intensity`, `anger_intensity`, `anxiety_intensity`, `calm_intensity`) on a 1..10 scale, plus `primary_emotion` (the argmax computed app-side), `emotion_summary`, `emotion_model`, and `emotion_raw`. There is no separate `emotion_analyses` table any more.
- Song recommendations live in a `songs jsonb` column on `diary_entries` (array of objects). Generation is not implemented — the column stays `NULL` until that lands.
- A diary entry can have **multiple** conversations, and `conversations.diary_entry_id` is **nullable** so users can start a chat without binding it to a diary.
- Period reports include a `stats` jsonb column with `{emotion: {avg, peak, days}}`. `mood_chart`, `stats`, and `dominant_emotion` are computed app-side from the entries (Gemini only writes the narrative `summary`).

See [PLAN.md §3](PLAN.md#3-데이터-모델) for the older relational sketch (now superseded by the inlined shape).

## Directory Conventions

- `backend/app/core/enums.py` — Shared domain enums (`DiaryStatus`, `Emotion`, `MessageRole`); imported by both entity and models layers
- `backend/app/entity/` — SQLAlchemy ORM classes (DB mapping)
- `backend/app/models/` — Pydantic schemas (API DTOs)
- `backend/app/repository/` — ORM-based CRUD abstraction
- `backend/app/services/` — Business logic, external APIs, LLM calls (background jobs live here too — analysis trigger is a `BackgroundTasks` call into `services/diary_analysis_service.py`)
- `backend/app/api/` — HTTP routing (keep thin)

## Supabase Rules

- **Sign-up / login is handled entirely by the frontend** via `@supabase/supabase-js`. The backend never touches passwords (no `/auth/signup` or `/auth/login` endpoints).
- The frontend passes the Supabase `access_token` as `Authorization: Bearer <token>` to the backend.
- The backend verifies the JWT in [core/security.py](backend/app/core/security.py) by fetching JWKS from `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` and validating ES256 signatures. HS256 + `SUPABASE_JWT_SECRET` is retained only as a fallback for legacy tokens.
- After verification, [core/dependencies.py](backend/app/core/dependencies.py) `get_current_user` upserts a `public.profiles` row — same PK as `auth.users.id` (UUID).
- All `user_id` fields are **UUID** (not integer). entity / repository / route signatures must all use UUID.
- **Row-Level Security (RLS)** is enabled on all user data tables. Manual checks like `entry.user_id != user.id` in routers are a secondary safeguard only — the DB enforces isolation.
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
- Structured outputs (emotion classification etc.) must enforce a JSON schema (`response_format` or vLLM `guided_json`) → Pydantic validation → DB persist

### Async Processing

- Diary analysis is always async (`POST /diary` returns `202` immediately; analysis runs in the background)
- Never block the request thread on LLM calls — response latency will break UX

## Decided

| # | Item | Decision |
|---|---|---|
| 2 | vLLM hosting | Separate container or external GPU server (removed from compose) |
| 3 | vLLM model (chatbot) | **`thillaic/CBT-Copilot`** (Llama-3.2-3B CBT LoRA) |
| 4 | Analysis trigger | **`BackgroundTasks`** (swap to Celery by modifying `services/diary_analysis_service.py` only) |
| 8 | Auth | **Supabase Auth** (custom JWT removed) |
| - | Report LLM | **Gemini API** (`gemini-2.5-flash`) |
| - | Emotion classification LLM | **Gemini API** (`gemini-2.5-flash`) |
| - | DB | **Supabase Postgres** (local DB container removed) |
| - | Language | **English** (all user input / prompts) |

## Pending Decisions

1. Song recommendations data source (LLM text / Spotify / YouTube)
2. Real-time analysis progress delivery (polling / SSE / **Supabase Realtime** preferred)
3. Re-analysis policy when a diary entry is edited

## Quick Command Reference

```bash
make backend   # build + run + stream logs
make down      # stop server
```
