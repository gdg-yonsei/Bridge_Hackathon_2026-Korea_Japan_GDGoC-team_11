# Bridge Hackathon 2026 — Korea·Japan GDGoC

> Project name: Solis

**Emotion Diary Service** (GDGoC Team 11).
Users write diary entries; the backend classifies emotions across 6 dimensions
in real time, runs the **Solis** AI companion for reflective conversations,
generates period reports, recommends a song via Spotify, and matches users to
licensed therapists across Korea and Japan when professional help is wanted.

- Detailed design: [PLAN.md](PLAN.md)
- Coding rules & conventions: [CLAUDE.md](CLAUDE.md)
- Backend API reference: [backend/README.md](backend/README.md)

## Live deployment

- Backend: https://my-app-486682024571.asia-northeast3.run.app (Cloud Run, region `asia-northeast3`)
- Swagger: `/docs`
- Healthcheck: `/health`

## Project Structure

```
.
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── scripts/
│   │   └── smoke.sh                  # end-to-end curl walkthrough
│   ├── supabase/
│   │   └── schema.sql                # idempotent migration + therapist seed
│   └── app/
│       ├── main.py                   # FastAPI app + routers + CORS + rate limit
│       ├── api/                      # HTTP routers (auth/diary/chat/report/therapist/song)
│       ├── core/                     # Config, dependencies, Gemini/Spotify clients, security
│       ├── db/                       # SQLAlchemy session
│       ├── entity/                   # ORM (DiaryEntry, Conversation, Report, Therapist, …)
│       ├── models/                   # Pydantic DTOs
│       ├── repository/               # CRUD abstraction
│       └── services/                 # Business logic + LLM calls + Spotify resolve
│
├── frontend/                         # React Native + Expo
│
├── Makefile                          # `make backend`, `make deploy`, …
├── PLAN.md
├── CLAUDE.md
└── README.md
```

## Quick Start

### Local (Docker)

```bash
cp backend/.env.example backend/.env   # then fill in the values
make backend                           # build + run + tail logs
make down                              # stop
```
- API: http://localhost:8000  ·  Swagger: `/docs`

### Cloud Run deploy

```bash
make deploy            # build → push to Artifact Registry → redeploy (tag = git short SHA)
make deploy TAG=v3     # override tag
```
Cloud Run env vars required: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`DATABASE_URL`, `GEMINI_API_KEY` (or `GEMINI_API_KEYS` pool). Optional:
`SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`, `CORS_ORIGINS`, `LOG_LEVEL`.

### Post-deploy verification

```bash
cd backend
export API_BASE=https://my-app-486682024571.asia-northeast3.run.app
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_ANON_KEY=sb_publishable_...
export TEST_EMAIL=...
export TEST_PASSWORD=...
./scripts/smoke.sh
```
Walks health → login → /auth/me → /diary/preview → /diary → analysis polling →
/conversations → /messages → /reports → /therapist/match. 10 green ticks = pass.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI · SQLAlchemy 2.0 · Pydantic v2 |
| LLM (everything) | **Gemini API** (`gemini-2.5-flash`) — chatbot · emotion classification · period reports · therapist re-rank · song suggestion |
| Music | **Spotify Web API** (Client Credentials Flow) — resolves Gemini-picked songs to preview URLs |
| DB · Auth | **Supabase** (Postgres + Auth + RLS, JWT verified via JWKS) |
| Rate limiting | `slowapi` (in-memory, keyed by Bearer-token tail) |
| Frontend | **React Native + Expo** · TypeScript |
| Infra | Cloud Run · Artifact Registry · Docker · uv |

## Directory conventions

- **entity/**: ORM classes mapped to DB tables
- **models/**: Pydantic schemas used for API I/O (DTOs)
- **repository/**: CRUD abstraction over ORM
- **services/**: Business logic, LLM/Spotify calls, background analysis
- **api/**: HTTP routing only — kept thin
- **scripts/**: One-off scripts (smoke test, etc.)
- **supabase/**: SQL files applied to the Supabase project

## Key features (current)

- **6 emotions, float 0-1**: `joy · calm · comfort · sad · anxious · angry` — stored inline on `diary_entries.scores` JSONB, no separate analyses table
- **Live emotion preview**: `POST /diary/preview` returns scores while the user is still typing (no DB write, rate-limited 200/hr)
- **Solis chatbot**: warm, non-clinical AI companion; multi-conversation per diary, plus standalone chats
- **Crisis safety net**: Gemini `crisis_score` + 1st-person English keyword override (forces `needs_hotline=true` even if model misses)
- **Period reports**: app-side aggregation of `mood_chart` + `stats` from analysed entries; Gemini only writes the narrative
- **Therapist matching** (`POST /therapist/match`): 2-layer rank — math filter (emotion overlap + concern keywords + online availability) → Gemini semantic re-rank via `response_schema=TherapistRankingList`. Top 3 returned with reasons.
- **Therapist directory** (`GET /therapist`): filterable read (country / language / concern / emotion / online / in_person / min_rating), seeded with 20 KR + JP profiles
- **Song recommendation**: Gemini suggests 5 famous English/Korean tracks fitting the diary; Spotify Search resolves with popularity ≥50 floor (cascading to ≥30, then any) and preview-URL preference. Final pick stored on `diary_entries.songs`. Standalone `GET /songs/search?q=...` for ad-hoc queries.
- **Async analysis**: `POST /diary` returns 202 immediately; analysis runs in a `BackgroundTask` with 3-attempt exponential backoff retry
- **Multi-key Gemini pool**: `GEMINI_API_KEYS` round-robins across keys to multiply free-tier RPM/RPD
- **JWT + RLS**: Supabase JWKS-verified ES256 tokens; RLS policies on every user-owned table

## Linked docs

- [PLAN.md](PLAN.md) — system design (some sections superseded by the current schema, see backend/README.md for ground truth)
- [CLAUDE.md](CLAUDE.md) — coding rules, architecture decisions, what's pending
- [backend/README.md](backend/README.md) — full API reference, DB schema, env vars, RLS policies
- [backend/supabase/schema.sql](backend/supabase/schema.sql) — idempotent migration + therapists seed
- [backend/scripts/smoke.sh](backend/scripts/smoke.sh) — end-to-end verification script
