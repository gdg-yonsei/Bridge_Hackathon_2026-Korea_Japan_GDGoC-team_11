# Bridge Hackathon 2026 — Korea·Japan GDGoC

> Project name: _TBD_

**Emotion Diary Service** (GDGoC Team 1).
Users write diary entries; the backend automatically classifies emotions, displays them on a calendar, generates summaries, song recommendations, and period-based reports.

- Detailed design: [PLAN.md](PLAN.md)
- Coding rules & conventions: [CLAUDE.md](CLAUDE.md)

## Project Structure

```
.
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── app/
│       ├── main.py
│       ├── api/                       # FastAPI routers
│       ├── core/                      # Config, dependencies, LLM clients, security
│       ├── db/                        # DB session & initialisation
│       ├── entity/                    # SQLAlchemy ORM entities
│       ├── models/                    # Pydantic schemas (request/response DTOs)
│       ├── repository/                # Data access layer
│       └── services/                  # Business logic & external API calls
│
├── frontend/
│   ├── Dockerfile
│   ├── next.config.ts
│   ├── package.json
│   └── app/                           # Next.js App Router
│
├── docker-compose.yml
├── Makefile
├── PLAN.md                            # System design, data model, API spec
├── CLAUDE.md                          # Coding rules & conventions
└── README.md
```

## Quick Start (Docker)

```bash
make backend   # build + run backend (logs streamed to backend/logs/)
make down      # stop
```

- Backend API: http://localhost:8000 (Swagger: `/docs`)

## Tech Stack

| Layer | Technology |
|------|------|
| Backend | FastAPI · SQLAlchemy 2.0 · Pydantic v2 |
| LLM (chatbot) | CBT-Copilot via vLLM |
| LLM (analysis & reports) | Gemini API (`gemini-2.5-flash`) |
| DB / Auth | Supabase (Postgres + Auth + RLS) |
| Frontend | Next.js 14 (App Router) · TypeScript · TailwindCSS |
| Infra | Docker Compose · uv |

## Directory Conventions

- **entity/**: ORM classes mapped to DB tables
- **models/**: Pydantic schemas used for API I/O (DTOs)
- **repository/**: CRUD abstraction over ORM
- **services/**: Business logic, external API calls, LLM processing
- **api/**: HTTP routing only — kept thin
