# Project-Wide Development Guide

**Project**: Emotion Diary · Bridge Hackathon 2026 Korea·Japan  
**Stack**: FastAPI · Next.js 14 · Gemini API · Supabase (Postgres + Auth)

For backend-specific guidance, see **[backend/AGENTS.md](backend/AGENTS.md)**.  
For frontend-specific guidance, see **[application/AGENTS.md](application/AGENTS.md)**.

---

## Quick Start

### Backend
```bash
cd backend && uv run uvicorn app.main:app --reload
```
Runs on `http://localhost:8000`. OpenAPI docs: `http://localhost:8000/docs`.

### Frontend (Expo/React Native)
```bash
cd application && npm run start  # or yarn/pnpm
```
Runs on `http://localhost:8081` (Expo dev server).

### Format & Lint
```bash
# Backend
cd backend && uv run ruff format . && uv run ruff check --fix .

# Frontend
cd application && npm run lint
```

---

## Project Structure

```
bridge-hackathon-2026-korea-japan/
├── backend/               # FastAPI + Gemini + Supabase
│   ├── app/
│   │   ├── entity/       # SQLAlchemy ORM classes
│   │   ├── models/       # Pydantic DTOs + LLM schemas
│   │   ├── services/     # Business logic + LLM calls
│   │   ├── api/          # HTTP routing
│   │   ├── repository/   # Data access (ORM abstraction)
│   │   ├── core/         # Config, security, DB, LLM clients
│   │   └── main.py
│   ├── pyproject.toml    # Dependencies (managed by uv)
│   ├── AGENTS.md         # Backend development guide
│   └── README.md
│
├── application/           # Next.js 14 · React Native (Expo)
│   ├── app/              # Expo Router pages
│   ├── src/              # Components, hooks, utilities
│   ├── package.json
│   ├── AGENTS.md         # Frontend development guide
│   └── README.md
│
├── PLAN.md               # Data model, LangGraph design, API spec
├── CLAUDE.md             # Project rules (must follow)
└── README.md             # Project overview
```

---

## Core Workflows

### 1. Diary Entry → Emotion Classification (Async)

```
User (Frontend)
  ↓ POST /diary {entry_date, title, content}
Backend Router (app/api/diary.py)
  ↓ Validate + Store (status = pending)
  ↓ Add background task
  ↓ Return 202 Accepted {entry_id, status}
User (Frontend)
  ↓ Poll GET /diary/{entry_id} or listen via Supabase Realtime
Background Task: trigger_analysis() (app/services/diary_analysis_service.py)
  ↓ Load entry from DB
  ↓ Call Gemini (structured output)
  ↓ Store emotion_analysis (primary_emotion, scores, summary)
  ↓ Update entry status = done
  ↓ Mark done in DB
Frontend
  ↓ Receive update + render emotion badge
```

**Key points**:
- Entry is stored immediately (pending).
- Gemini call happens in background (~10s).
- Failure sets entry status to `failed`; user can retry.

### 2. Period Report Generation

```
User (Frontend)
  ↓ POST /reports {period_start, period_end}
Backend Router (app/api/report.py)
  ↓ Fetch diary entries + emotion analyses for the period
  ↓ Build prompt from entries + analysis results
  ↓ Call Gemini (structured output)
  ↓ Store report (dominant_emotion, summary, mood_chart)
  ↓ Return ReportOut
Frontend
  ↓ Display summary + mood chart
```

**Key points**:
- Report generation is synchronous (user waits).
- Prompt includes analyzed emotions to ground the summary.

---

## Gemini API Conventions

### Pattern: Structured Outputs

All LLM calls use `response_schema` with Pydantic models to enforce JSON responses:

```python
# In app/models/ — define the schema
class MyLLMResult(BaseModel):
    field1: str = Field(..., description="What this is")
    field2: dict = Field(..., description="Structure expected")

# In app/services/ — call Gemini
from app.core.gemini_client import get_gemini_client
from google.genai import types

client = get_gemini_client()
response = client.models.generate_content(
    model=settings.gemini_model,  # gemini-2.5-flash
    contents=user_prompt,
    config=types.GenerateContentConfig(
        system_instruction="Your expert role...",
        response_mime_type="application/json",
        response_schema=MyLLMResult,
        temperature=0.4,  # or 0.6 for reports
    ),
)

# Always use safe parsing fallback
parsed: MyLLMResult | None = getattr(response, "parsed", None)
if parsed is None:
    parsed = MyLLMResult.model_validate(json.loads(response.text))
```

**Why structured outputs?**
- Prevents hallucinations.
- Ensures data reaches DB cleanly.
- Pydantic validates and raises errors if schema doesn't match.

---

## Authentication & Authorization

- **Frontend handles sign-up/login** via Supabase Auth (`@supabase/supabase-js`).
- **Backend verifies JWT** in `app/core/security.py` using `SUPABASE_JWT_SECRET`.
- **User is upserted** in `public.profiles` on first API call (see `app/core/dependencies.py`).
- **All user_id fields are UUID** (Supabase `auth.users.id` type).
- **Row-Level Security (RLS)** enabled on all user data tables — DB enforces isolation.
- **Service role key** is held by backend only — never expose to frontend or commit to git.

---

## Data Model

```
users (Supabase Auth)
  id, email, nickname, created_at

profiles (Supabase public table — synced with auth.users)
  id (= auth.users.id, UUID), email, created_at

diary_entries
  id, user_id (FK, UUID), entry_date, title, content,
  status (pending | analyzing | done | failed),
  created_at, updated_at

emotion_analyses
  id, entry_id (FK UNIQUE), primary_emotion,
  scores (JSONB: {joy: 0.7, sad: 0.1, ...}),
  summary, model_name, created_at

song_recommendations
  id, entry_id (FK), rank, title, artist, reason, external_url, created_at

reports
  id, user_id (FK, UUID), period_start, period_end,
  dominant_emotion, summary, mood_chart (JSONB),
  model_name, generated_at
  UNIQUE (user_id, period_start, period_end)
```

See [PLAN.md §3](PLAN.md#3-데이터-모델) for full column definitions.

---

## Environment Variables

### Backend (`.env`)

```bash
# Supabase
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_JWT_SECRET=your-jwt-secret
DATABASE_URL=postgresql+psycopg2://postgres.<ref>:pw@aws-0-<region>.pooler.supabase.com:6543/postgres

# Gemini
GEMINI_API_KEY=AI...
GEMINI_MODEL=gemini-2.5-flash

# vLLM (CBT-Copilot chatbot, future feature)
VLLM_BASE_URL=http://vllm:8000/v1
VLLM_API_KEY=EMPTY
VLLM_MODEL=thillaic/CBT-Copilot
```

### Frontend (`.env.local`)

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
```

---

## Work Rules

### Code Style

- **Backend (Python)**: snake_case for functions/variables, PascalCase for classes
- **Frontend (TypeScript)**: camelCase for functions/variables, PascalCase for components
- **Comments**: Write the *why* only — never the *what*
- **Imports**: Organize with blank lines between stdlib, third-party, local

### Dependencies

- **Backend**: `pyproject.toml` + `uv` only (no `pip`)
  - Add: `cd backend && uv add <pkg>` (or `uv add --dev <pkg>`)
  - Commit `uv.lock` after changes
- **Frontend**: `package.json` + npm/yarn/pnpm
  - Commit `package-lock.json` (or `yarn.lock`, `pnpm-lock.yaml`)

### No Linear

**Linear is forbidden.** Create branches locally only — no issues, projects, or comments in Linear.

### API Design

- **Router thin**: Validation + error handling only. No business logic.
- **Service thick**: All LLM calls, DB logic, external APIs.
- **Async processing**: Long operations (LLM calls) → background tasks, return 202 Accepted.

---

## Testing & Debugging

### Backend

```bash
cd backend

# Run the server with hot reload
uv run uvicorn app.main:app --reload

# Format & lint
uv run ruff format . && uv run ruff check --fix .

# Check for type errors (if mypy is added)
uv run mypy app/
```

### Frontend

```bash
cd application

# Start Expo
npm run start

# Build for iOS/Android
npm run build:ios   # or build:android
```

### Debugging Gemini Calls

1. Check `.env` has `GEMINI_API_KEY`.
2. Enable logging:
   ```python
   import logging
   logging.basicConfig(level=logging.DEBUG)
   ```
3. Call Gemini directly to test:
   ```python
   from app.services.diary_analysis_service import _call_gemini
   result = _call_gemini(title="Test", content="I'm sad", entry_date="2026-05-17")
   print(result)
   ```
4. Check response structure — `response.text` contains raw JSON if `response.parsed` is `None`.

---

## Pending Decisions

1. Song recommendations data source (LLM text / Spotify / YouTube)
2. Real-time progress delivery (polling / SSE / Supabase Realtime)
3. Re-analysis policy when a diary entry is edited

---

## Related Documentation

- **[PLAN.md](PLAN.md)** — Data model, LangGraph design, API endpoints, architecture decisions
- **[CLAUDE.md](CLAUDE.md)** — Project rules (tech stack, code style, work rules)
- **[backend/AGENTS.md](backend/AGENTS.md)** — Backend-specific development guide
- **[application/AGENTS.md](application/AGENTS.md)** — Frontend-specific development guide
- **[Google AI SDK docs](https://ai.google.dev/gemini-api/docs)** — Gemini API reference
- **[Supabase docs](https://supabase.com/docs)** — Auth, database, realtime
- **[FastAPI docs](https://fastapi.tiangolo.com/)** — Backend framework
- **[Next.js 14 / Expo docs](https://docs.expo.dev/)** — Frontend framework
