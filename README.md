# Solis · Emotion Diary Companion

> An AI-powered emotional journaling app for Korea and Japan. From the
> moment you start writing, Solis names what you're feeling, sits with you
> in conversation, and — when you're ready — bridges you to a therapist.
>
> Bridge Hackathon 2026 · GDGoC Yonsei Team 11

---

## 🌉 Why we built this

Korea and Japan share two stubborn walls around mental health:

- **Stigma**: the psychological cost of saying "I'm seeing a therapist" is high
- **Access**: bilingual licensed therapists are rare; the path from "I might need help" to a first appointment is months long

The gap between *noticing something is off* and *talking to a professional* is the bridge that's missing. Solis fills it: a daily journaling habit that grows self-awareness, names emotions in real time, and — only when the user is ready — opens the door to a curated bilingual therapist directory.

---

## ✨ What the product does

| Step | What the user sees | Backend |
|---|---|---|
| **1. Write & watch** | While typing, six emotion bars on the side react in real time | `POST /diary/preview` — Gemini live classification, no DB write |
| **2. Save** | Hit save → entry shows up on the calendar coloured by primary emotion | `POST /diary` 202 → background full analysis (3-retry + model fallback) |
| **3. Solis reflects** | A warm one-line reflection + gentle suggestion + (if needed) hotline card | `solis_message`, `suggested_action`, `needs_hotline` inlined on the diary row |
| **4. Song of the day** | One song matched to today's mood — 30 s in-app preview + full-track link | Gemini picks 5 famous EN/KR tracks → Spotify resolves with popularity floor → 1 pick |
| **5. Keep talking** | "Talk more" → multi-turn chat with Solis | `POST /conversations/{id}/messages` |
| **6. Period report** | Mood chart over 7–30 days, dominant emotion, narrative summary | `POST /reports` |
| **7. Therapist match** | "Talk to a professional" → top 3 KR/JP therapists with reasons | `POST /therapist/match` — 2-layer (math + Gemini) |

---

## 🎯 The 6-emotion model

`joy · calm · comfort · sad · anxious · angry`

Each emotion is scored independently as a float in `[0, 1]` (they don't sum to 1). The argmax becomes `primary_emotion` — the colour used on the calendar tile.

Why these six (and not nine or five)?

- Dropped `embarrassment` / `envy`: rarely surface in Korean / Japanese diary tone
- Dropped `boredom` / `nostalgia`: more state than emotion in our test corpus
- Added `comfort`: captures the "settled / at ease" register Korean and Japanese journalers use often, distinct from `calm`

---

## 🛡️ Crisis safety net

We don't compromise on signal detection for at-risk users. Two layers, in order:

1. **Gemini `crisis_score`** (0.0–1.0) returned alongside every analysis. ≥ 0.8 auto-flips `needs_hotline=true`.
2. **Keyword override** — a curated set of first-person English crisis phrases (`"I want to die"`, `"end my life"`, …). Match overrides the model and forces `needs_hotline=true` regardless of the score.

When `needs_hotline=true` is set, the frontend surfaces a hotline card immediately.

---

## 🤝 Therapist matching (2-layer)

20 curated KR + JP therapist profiles seeded in the `therapists` table. When the user taps "Talk to a professional", we run:

**Layer 1 — math filter** (20 → top 5):
- User emotion scores × therapist's treated-emotions overlap (50%)
- User concern keywords ↔ therapist specialties overlap (30%)
- Online-availability bonus (20%)

**Layer 2 — Gemini semantic re-rank** (5 → final 3):
- The user's clinical summary is sent alongside; Gemini re-orders by fit
- Structured output enforced via `response_schema=TherapistRankingList`
- Each match returns `match_reason`, `matched_concerns`, `approach_fit`

---

## 🌐 Live deployment

- **Backend**: https://my-app-486682024571.asia-northeast3.run.app
- **Swagger UI**: `/docs`
- **Health check**: `/health`
- **Region**: Google Cloud Run · `asia-northeast3` (Seoul)

---

## 🏗️ Architecture

```
┌────────────────────────────────────┐
│   React Native + Expo (mobile)     │
│   ─ expo-av: 30 s in-app preview   │
│   ─ Supabase JS: login + JWT       │
└─────────────────┬──────────────────┘
                  │ HTTPS + Bearer
                  ▼
┌────────────────────────────────────┐
│   FastAPI on Cloud Run             │
│   ─ JWKS (ES256) JWT verification  │
│   ─ slowapi rate limiting          │
│   ─ BackgroundTasks for analysis   │
└──┬─────────────┬──────────────┬────┘
   │             │              │
   ▼             ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Supabase │  │ Gemini   │  │ Spotify  │
│ Postgres │  │ API      │  │ Web API  │
│ + Auth   │  │ 2.5/2.0  │  │ Search   │
│ + RLS    │  │ Flash    │  │ + Track  │
└──────────┘  └──────────┘  └──────────┘
```

### Resilience by design

| Failure mode | Mitigation |
|---|---|
| Gemini RPM / RPD quota burst | **Key-pool round-robin** — set `GEMINI_API_KEYS` to a comma-separated list; every call cycles to the next key |
| Single model's quota window full | **Model fallback** — on 429, retries the same call against `gemini_fallback_model` (default `gemini-2.0-flash`, separate quota bucket) |
| Transient Gemini 5xx in background | **3-attempt exponential backoff** in `trigger_analysis` |
| Spotify creds missing / search miss | **Graceful degrade** — song recommendation skipped, emotion analysis still saves |
| Model under-detects crisis | **Keyword override** — first-person English phrases force `needs_hotline=true` |
| Concurrent users | Per-request DB session, lock-guarded JWKS cache, thread-safe Gemini client, thread-safe slowapi storage |

---

## 🧰 Tech stack

| Layer | Technology |
|---|---|
| **Backend** | FastAPI · SQLAlchemy 2.0 · Pydantic v2 · uv |
| **AI** | Gemini API (`gemini-2.5-flash` primary, `gemini-2.0-flash` fallback) · `response_schema` structured output |
| **Music** | Spotify Web API (Client Credentials Flow) |
| **DB · Auth** | Supabase Postgres + Auth + RLS · JWKS ES256 JWT verification |
| **Rate limiting** | `slowapi` (in-memory, keyed by Bearer-token tail) |
| **Frontend** | React Native + Expo · TypeScript |
| **Infra** | Cloud Run · Artifact Registry · Docker · key-pool round-robin · model fallback |

---

## 🚀 Quick start

### Run backend locally

```bash
cd backend
cp .env.example .env          # fill in Supabase + Gemini keys (Spotify optional)
make backend                  # docker build + run + tail logs
make down                     # stop
```
- API: http://localhost:8000 · Swagger: `/docs`

Full env-var list and API reference: **[backend/README.md](backend/README.md)**

### Deploy to Cloud Run

```bash
make deploy                   # build → push to Artifact Registry → redeploy (TAG = git short SHA)
make deploy TAG=v3            # explicit tag
make deploy-run               # same image, refresh env vars only
```

### Smoke test after deploy

```bash
cd backend
export API_BASE=https://my-app-486682024571.asia-northeast3.run.app
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_ANON_KEY=sb_publishable_...
export TEST_EMAIL=...
export TEST_PASSWORD=...
./scripts/smoke.sh
```

Passes 10 stages end-to-end:
`/health` → login → `/auth/me` → `/diary/preview` → `/diary` → analysis polling → `/conversations` → message → `/reports` → `/therapist/match`.

---

## 📂 Repository layout

```
.
├── backend/                          # FastAPI server
│   ├── Dockerfile                    # uv multi-stage, honours $PORT for Cloud Run
│   ├── pyproject.toml
│   ├── scripts/
│   │   └── smoke.sh                  # end-to-end curl walkthrough
│   ├── supabase/
│   │   └── schema.sql                # idempotent migration + therapists seed (20 profiles)
│   └── app/
│       ├── main.py                   # FastAPI app + routers + CORS + rate limit + logging
│       ├── api/                      # HTTP routers (auth · diary · chat · report · therapist · song)
│       ├── core/                     # config · dependencies · security(JWKS) · gemini_client · spotify_client · rate_limit
│       ├── db/                       # SQLAlchemy session
│       ├── entity/                   # ORM (DiaryEntry · Conversation · Message · Report · Therapist · User)
│       ├── models/                   # Pydantic DTOs
│       ├── repository/               # CRUD abstraction
│       └── services/                 # Business logic · LLM calls · Spotify · background analysis
│           ├── prompts.py            # All LLM system prompts
│           ├── diary_analysis_service.py
│           ├── chatbot_service.py
│           ├── report_service.py
│           ├── therapist_service.py
│           └── song_service.py
│
├── application/                      # React Native + Expo app
│
├── Makefile                          # `make backend`, `make deploy`, …
├── PLAN.md                           # Initial design (some schema sections superseded)
├── CLAUDE.md                         # Coding rules · architecture decisions · pending items
└── README.md                         # You are here
```

---

## 📚 Further reading

- **[backend/README.md](backend/README.md)** — full API reference, data model, env vars, RLS policies, deploy notes
- **[CLAUDE.md](CLAUDE.md)** — coding conventions, architecture decisions, what's intentionally pending
- **[backend/supabase/schema.sql](backend/supabase/schema.sql)** — idempotent DB schema + therapists seed
- **[backend/scripts/smoke.sh](backend/scripts/smoke.sh)** — post-deploy verification script
- **[PLAN.md](PLAN.md)** — original system design (treat backend/README as the current source of truth)

---

## 👥 Team — GDGoC Yonsei Team 11

Hackathon members:
- Backend · AI · Infrastructure
- Frontend (React Native + Expo)
- Design · Product

> Bridge Hackathon 2026 — Korea·Japan GDGoC
