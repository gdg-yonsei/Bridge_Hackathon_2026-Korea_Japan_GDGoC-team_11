# Backend Development Guide

This document helps AI agents work effectively in this FastAPI + Gemini backend codebase.

## Quick Start

**Tech Stack**: FastAPI · SQLAlchemy 2.0 · Pydantic v2 · Gemini API · Supabase (Postgres + Auth)

**Run the server**:
```bash
cd backend && uv run uvicorn app.main:app --reload
```

**Format & lint**:
```bash
cd backend && uv run ruff format . && uv run ruff check --fix .
```

**Key directories**:
- `app/entity/` — SQLAlchemy ORM classes
- `app/models/` — Pydantic schemas (API DTOs)
- `app/services/` — Business logic, LLM calls, external APIs
- `app/api/` — HTTP routing (keep thin)
- `app/core/` — Config, security, database, LLM clients

---

## Gemini API Integration Patterns

This backend uses **Google AI SDK** (`google-genai`) for emotion classification and report generation. See `app/core/gemini_client.py` for the client factory.

### Pattern 1: Structured Outputs with JSON Schema

Always use `response_schema` to enforce JSON responses that match Pydantic models:

```python
from google.genai import types
from app.core.gemini_client import get_gemini_client
from app.models.diary import DiaryAnalysisLLMResult

client = get_gemini_client()
response = client.models.generate_content(
    model=settings.gemini_model,  # gemini-2.5-flash
    contents="User diary text here",
    config=types.GenerateContentConfig(
        system_instruction="Your expert role...",
        response_mime_type="application/json",
        response_schema=DiaryAnalysisLLMResult,  # Pydantic model
        temperature=0.4,
    ),
)
```

**Why**: Structured outputs prevent hallucinations and ensure valid data reaches the DB. Always define the schema as a Pydantic model with clear `Field` descriptions.

### Pattern 2: Safe Parsing Fallback

The Google AI SDK may return `parsed` objects or raw JSON text. Always handle both:

```python
parsed: DiaryAnalysisLLMResult | None = getattr(response, "parsed", None)
if parsed is None:
    parsed = DiaryAnalysisLLMResult.model_validate(json.loads(response.text))
```

**Why**: Robust fallback ensures the flow never breaks if the SDK changes.

### Pattern 3: Background Task Orchestration

Async analysis keeps request latency low. Use `trigger_analysis()` from `diary_analysis_service.py`:

```python
# In router: POST /diary
diary = DiaryRepository(db).create(...)
db.commit()
background_tasks.add_task(trigger_analysis, entry_id=diary.id)
return DiaryAccepted(entry_id=diary.id, status=DiaryStatus.pending)  # 202
```

**Why**: LLM calls (~10s latency) block UX if synchronous. Always offload to background.

### Pattern 4: Emotion Classification

**Location**: `app/services/diary_analysis_service.py`

Classifies diary entries into 5 emotions: `joy`, `sad`, `anger`, `anxiety`, `calm`.

**Schema** (`DiaryAnalysisLLMResult`):
- `primary_emotion: Emotion` — best-fit category
- `scores: dict[str, float]` — probability for each emotion (sum ~1.0)
- `summary: str` — one-sentence emotional tone

**Failure handling**: If Gemini fails, the entry status is set to `failed` and logged. The entry remains in the DB; the UI can retry via re-submission.

### Pattern 5: Period Report Generation

**Location**: `app/services/report_service.py`

Generates 3–5 sentence summaries over a date range using diary entries + their emotion analyses.

**Schema** (`ReportLLMResult`):
- `dominant_emotion: Emotion` — most prevalent emotion across the period
- `summary: str` — narrative in second person ("You felt...")
- `mood_chart: dict[str, dict[str, float]]` — per-day emotion scores, keyed by ISO date (YYYY-MM-DD)

**Key**: Prompt includes the user's analyzed emotions (from `emotion_analyses`) to anchor the summary in fact.

---

## Common Patterns

### Adding a New Gemini Call

1. **Define the Pydantic schema** in `app/models/` with clear `Field` descriptions:
   ```python
   class MyLLMResult(BaseModel):
       field1: str = Field(..., description="What this field is for")
       field2: dict = Field(..., description="Expected structure")
   ```

2. **Create the service method** in `app/services/`:
   ```python
   def my_operation(param: str) -> MyLLMResult:
       client = get_gemini_client()
       response = client.models.generate_content(
           model=settings.gemini_model,
           contents=param,
           config=types.GenerateContentConfig(
               system_instruction="Your role and rules...",
               response_mime_type="application/json",
               response_schema=MyLLMResult,
               temperature=0.5,
           ),
       )
       parsed: MyLLMResult | None = getattr(response, "parsed", None)
       if parsed is None:
           parsed = MyLLMResult.model_validate(json.loads(response.text))
       return parsed
   ```

3. **Call from the service, never the router**:
   ```python
   # Good: router calls service
   result = my_operation(user_input)
   
   # Bad: router calls Gemini directly ❌
   ```

### Error Handling

- **Gemini failures**: Catch `Exception`, log details, return HTTP 502 (Bad Gateway) to the client. For background tasks, mark the DB entry as `failed`.
- **Malformed JSON**: Pydantic validation will catch it. Return HTTP 502 with a user-friendly message.
- **Missing API key**: `get_gemini_client()` raises `RuntimeError` if `GEMINI_API_KEY` is empty. Fail fast at startup.

---

## Supabase & Auth

- **Frontend handles sign-up/login** — the backend never touches passwords.
- **Access token** is passed as `Authorization: Bearer <token>` to all backend calls.
- **JWT verification** in `app/core/security.py` decodes the Supabase JWT using `SUPABASE_JWT_SECRET`.
- **User upsert**: On first API call, `get_current_user` (in `app/core/dependencies.py`) upserts a `public.profiles` row.
- **All `user_id` fields are UUID**, not integer.
- **Row-Level Security (RLS)** is enabled on user data tables — the DB enforces isolation.

**Key file paths**:
- JWT verification: `app/core/security.py`
- User retrieval: `app/core/dependencies.py`
- Supabase config: `app/core/config.py`

---

## Data Model & Repositories

```
users (Supabase Auth)
  ├─ diary_entries (status: pending | analyzing | done | failed)
  │   ├─ emotion_analyses (1:1, primary_emotion + scores + summary)
  │   └─ song_recommendations (1:N)
  └─ reports (by period: period_start, period_end)
```

**Pattern: Always use repositories**
```python
# Good
diary_repo = DiaryRepository(db)
entry = diary_repo.get(entry_id)

# Bad: raw SQL or ORM queries in routers ❌
```

Repositories live in `app/repository/` and abstract SQLAlchemy operations.

---

## Temperature & Model Selection

- **Emotion classification** (`diary_analysis_service.py`): `temperature=0.4` — deterministic, consistent results
- **Report generation** (`report_service.py`): `temperature=0.6` — slightly more creative, but grounded in data
- **Model**: `gemini-2.5-flash` (set in `.env` as `GEMINI_MODEL`)

---

## Testing & Debugging

### Local Testing

1. **Set `.env`**:
   ```bash
   GEMINI_API_KEY=your-key-from-aistudio.google.com
   GEMINI_MODEL=gemini-2.5-flash
   ```

2. **Trigger analysis manually**:
   ```python
   from app.services.diary_analysis_service import trigger_analysis
   trigger_analysis(entry_id=1)
   ```

3. **Check logs**:
   ```bash
   tail -f app.log  # See any Gemini failures
   ```

### Common Issues

| Issue | Solution |
|-------|----------|
| `GEMINI_API_KEY is empty` | Get a key at https://aistudio.google.com/apikey and add to `.env` |
| `response.parsed is None` | Add fallback: `json.loads(response.text)` and validate with Pydantic |
| Entry stuck in `analyzing` | Check logs for exceptions; if none, trigger_analysis may not have run. Restart server. |
| Report JSON malformed | Check Gemini's mood_chart format (must use ISO dates, floats for scores) |

---

## Conventions

- **Functions & variables**: `snake_case`
- **Classes**: `PascalCase`
- **Comments**: Write the *why* only — never the *what* (code is self-documenting)
- **Imports**: Group stdlib, third-party, local (with blank lines between)
- **No LLM calls in routers** — always defer to `services/`

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) — Project rules & decisions
- [PLAN.md](../PLAN.md) — Data model, LangGraph design, API endpoint specs
- [Google AI SDK docs](https://ai.google.dev/gemini-api/docs)
- [Supabase Auth docs](https://supabase.com/docs/guides/auth)
