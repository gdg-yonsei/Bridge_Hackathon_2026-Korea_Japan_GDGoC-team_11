# Backend

FastAPI · SQLAlchemy 2.0 · Pydantic v2 · Supabase (Postgres + Auth) · Gemini

> 도메인: 감정 일기장. 사용자가 일기를 쓰면 Gemini가 9감정 점수(0-1 float)와 위기 신호를
> 분석, **Solis** 챗봇이 일기 또는 standalone 대화를 처리, 기간 리포트를 Gemini가 생성,
> 그리고 사용자에게 맞는 상담사를 매칭. 인증·DB는 Supabase가 호스팅.
> 전체 설계는 [../PLAN.md](../PLAN.md), 작업 규칙은 [../CLAUDE.md](../CLAUDE.md).

## 빠른 시작

### 1) Supabase 준비

1. [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트 → SQL Editor
2. [supabase/schema.sql](supabase/schema.sql) 통째로 붙여넣고 **Run** (멱등 — 여러 번 돌려도 안전, therapists 시드 포함)
3. Settings → API 에서 다음을 복사해 `.env` 채우기:
   - Project URL → `SUPABASE_URL`
   - publishable key (`sb_publishable_...`) → `SUPABASE_ANON_KEY`
   - secret key (`sb_secret_...`) → `SUPABASE_SERVICE_ROLE_KEY`
4. Settings → Database → Connection string → **Session/Transaction Pooler** URI → `DATABASE_URL`
   - `postgresql://` → `postgresql+psycopg2://` 로 바꾸고 `?sslmode=require` 추가
5. [Google AI Studio](https://aistudio.google.com/apikey) → `GEMINI_API_KEY`

> 새 Supabase 프로젝트는 ECC P-256 (ES256) 키로 JWT 를 서명한다. 백엔드
> [core/security.py](app/core/security.py) 는 `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`
> 에서 공개 키를 가져와 검증하므로 `SUPABASE_JWT_SECRET` 은 보통 안 채워도 됨
> (legacy HS256 토큰 검증용 fallback 으로만 남음).

### 2) 로컬 실행

```bash
make backend   # 루트에서 — 백엔드 도커 이미지 빌드 + 컨테이너 실행 + 로그 스트림
make down      # 컨테이너 종료
```

또는 Docker 없이:

```bash
cd backend
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API: http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- OpenAPI JSON: http://localhost:8000/openapi.json

### 3) 인증 토큰 얻기

회원가입/로그인은 백엔드를 거치지 않는다. 프론트의 `@supabase/supabase-js` 또는 REST 로:

```bash
# 가입
curl -X POST "$SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"..."}'

# 로그인
curl -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"..."}'
# → { "access_token": "...", ... }
```

이 `access_token` 을 모든 백엔드 호출의 `Authorization: Bearer <token>` 으로 사용.

### 4) 배포 후 스모크 테스트

```bash
export API_BASE=https://<배포된-백엔드>
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_ANON_KEY=sb_publishable_...
export TEST_EMAIL=you@example.com
export TEST_PASSWORD=...
./scripts/smoke.sh
```

health → 로그인 → /auth/me → 일기 작성 → 분석 폴링 → 채팅 → 리포트 → therapist 매칭까지 9단계 전부 확인.

---

## API 레퍼런스

> 모든 사용자 데이터 엔드포인트는 `Authorization: Bearer <supabase access_token>` 필요.

### 공통 상태 코드

| Status | When |
|---|---|
| `401 Unauthorized` | 토큰 없음·만료·시그니처 불일치 |
| `404 Not Found` | 해당 리소스 없거나 본인 소유 아님 |
| `409 Conflict` | 중복 (같은 날짜에 이미 일기 존재) |
| `422 Unprocessable Entity` | Pydantic 검증 실패 |
| `429 Too Many Requests` | Rate limit 초과 (`/reports` 20/hr, `/therapist/match` 10/hr) |
| `502 Bad Gateway` | Gemini 호출 실패 또는 응답 파싱 실패 |

### `GET /health`

인증 불필요. `{ "status": "ok" }`.

---

### `GET /auth/me`

현재 사용자 프로필 조회. 토큰 첫 사용 시 `profiles` 행이 자동 생성됨.

**Response 200** — `UserOut`
```json
{ "id": "uuid-...", "email": "you@example.com", "nickname": null, "created_at": "..." }
```

### `PATCH /auth/me`

프로필 업데이트 (현재는 닉네임만).

**Request** — `{ "nickname": "alice" }`
**Response 200** — `UserOut`

---

### `POST /diary`

일기 작성. 백그라운드로 감정 분석 트리거. 같은 날짜에 이미 있으면 **409**.

**Request** — `DiaryCreate`
```json
{ "entry_date": "2026-05-17", "title": "Today was odd", "content": "I felt anxious..." }
```

**Response 202** — `DiaryAccepted`
```json
{ "entry_id": 42, "entry_date": "2026-05-17", "status": "pending" }
```

### `GET /diary?year=2026&month=5`

캘린더 월간 뷰.

**Response 200** — `list[DiaryListItem]`
```json
[
  { "entry_id": 1, "entry_date": "2026-05-01", "primary_emotion": "calm", "status": "done" },
  { "entry_id": 2, "entry_date": "2026-05-17", "primary_emotion": null,   "status": "analyzing" }
]
```

### `GET /diary/{entry_id}`

일기 단건 + 인라인된 감정 분석 + Solis 응답 + (TBD) 노래 추천.

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
    "joy": 0.2, "sad": 0.1, "anger": 0.0, "anxiety": 0.7, "calm": 0.6,
    "embarrassment": 0.0, "envy": 0.0, "boredom": 0.1, "nostalgia": 0.0
  },
  "emotion_summary": "An anxious morning that settled into a calmer afternoon.",
  "crisis_score": 0.1,
  "solis_message": "It sounds like a walk helped you find some ground...",
  "suggested_action": "Try a 5-minute morning breathing exercise tomorrow.",
  "needs_hotline": false,
  "songs": null,
  "created_at": "...",
  "updated_at": "..."
}
```

- `scores` 는 분석 완료(`status=done`) 시 9감정 float [0,1], pending/failed 시 null
- `primary_emotion` 은 9감정 중 argmax (Gemini가 계산해서 반환)
- `crisis_score` 는 [0,1], `needs_hotline` 은 0.8 이상이거나 위기 키워드 매칭 시 true
- `songs` 는 미구현 — 항상 null

### `PUT /diary/{entry_id}`

본문/제목 수정. 본문이 바뀌면 모든 분석 컬럼이 초기화되고 `status=pending` 으로 재트리거.

**Request** — `DiaryUpdate` (필드 optional)
**Response 200** — `DiaryAccepted`

### `DELETE /diary/{entry_id}`

일기 삭제. **204**. 본인 소유 아니면 404.

### `POST /diary/{entry_id}/reanalyze`

분석 수동 재시작. **202** — `DiaryAccepted`.

---

### `GET /conversations`

Solis 챗봇 대화 목록. `?diary_id=X` 로 특정 일기에 묶인 것만 필터 가능.

**Response 200** — `list[ConversationSummary]`
```json
[
  { "id": 7, "diary_entry_id": 42,   "title": null,   "created_at": "...", "updated_at": "..." },
  { "id": 8, "diary_entry_id": null, "title": "잡담", "created_at": "...", "updated_at": "..." }
]
```

### `POST /conversations`

새 대화 세션 생성. `diary_entry_id` 가 null 이면 standalone 채팅, 값이 있으면 그 일기에 묶임.

**Request** — `ConversationCreate`
```json
{ "diary_entry_id": 42, "title": null }
```

**Response 201** — `ConversationSummary`

### `GET /conversations/{conversation_id}`

대화 전체 히스토리 (메시지 포함).

**Response 200** — `ConversationDetail`
```json
{
  "id": 7,
  "diary_entry_id": 42,
  "title": null,
  "created_at": "...",
  "updated_at": "...",
  "messages": [
    { "role": "user",      "content": "...", "created_at": "..." },
    { "role": "assistant", "content": "...", "created_at": "..." }
  ]
}
```

### `POST /conversations/{conversation_id}/messages`

Solis(Gemini) 동기 호출. user + assistant 메시지 둘 다 저장하고 반환. 응답 1-3 초.

**Request** — `{ "message": "..." }`
**Response 200** — `ChatTurnResponse`
```json
{
  "user_message":      { "role": "user",      "content": "...", "created_at": "..." },
  "assistant_message": { "role": "assistant", "content": "...", "created_at": "..." }
}
```

**Error 502** — Gemini 호출 실패 / 빈 응답.

### `DELETE /conversations/{conversation_id}`

대화 삭제 (메시지 CASCADE). 본인 소유 아니거나 이미 없어도 **204** (멱등).

---

### `POST /reports`

기간 받아 리포트 즉시 생성. 같은 (user, start, end) 조합으로 다시 호출하면 덮어씀. **Rate limit: 20/hour**.

- `mood_chart` · `stats` · `dominant_emotion` 은 백엔드가 일기 데이터로부터 직접 집계 —
  Gemini 는 narrative `summary` 만 생성
- 통계는 분석 완료(`status=done`) 인 entries 만 대상

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
    "2026-05-11": { "joy": 0.4, "sad": 0.7, "anger": 0.2, "anxiety": 0.6, "calm": 0.3,
                    "embarrassment": 0.1, "envy": 0.0, "boredom": 0.2, "nostalgia": 0.1 },
    "2026-05-12": { "joy": 0.6, "sad": 0.4, "anger": 0.1, "anxiety": 0.3, "calm": 0.7,
                    "embarrassment": 0.0, "envy": 0.0, "boredom": 0.1, "nostalgia": 0.2 }
  },
  "stats": {
    "joy":     { "avg": 0.52, "peak": 0.8, "days": 1 },
    "sad":     { "avg": 0.40, "peak": 0.7, "days": 1 },
    "anger":   { "avg": 0.15, "peak": 0.2, "days": 0 },
    "anxiety": { "avg": 0.40, "peak": 0.6, "days": 1 },
    "calm":    { "avg": 0.55, "peak": 0.8, "days": 4 }
  },
  "model_name": "gemini-2.5-flash",
  "generated_at": "..."
}
```

- `stats.{emotion}.avg` — 기간 내 평균 점수 (0.0-1.0)
- `stats.{emotion}.peak` — 기간 내 최대 점수 (0.0-1.0)
- `stats.{emotion}.days` — 해당 감정이 primary 였던 일수

**Error 상태**
- `400` — `period_end < period_start`
- `404` — 해당 기간에 분석된 일기 없음
- `429` — Rate limit 초과
- `502` — Gemini 호출 실패

---

### `POST /therapist/match`

사용자 임상 요약 + 감정 프로필을 받아 매칭된 상담사 top 3 반환. **Rate limit: 10/hour**.

- Layer 1 (수학) — 감정 겹침 50%, 고민 키워드 30%, online 보너스 20%로 상위 5명 추림
- Layer 2 (Gemini) — `response_schema=TherapistRankingList` 로 의미적 재랭킹

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
    "joy": 0.2, "sad": 0.1, "anger": 0.0, "anxiety": 0.7, "calm": 0.4,
    "embarrassment": 0.0, "envy": 0.0, "boredom": 0.0, "nostalgia": 0.0
  },
  "language": "both"
}
```
- `language`: `"korean"` (KR만), `"japanese"` (JP만), `"both"`(기본)

**Response 200** — `TherapistMatchResponse`
```json
{
  "top_matches": [
    {
      "therapist_id": "KR001",
      "name": "Dr. Kim Soo-Yeon",
      "location": "Seoul, Korea",
      "languages": ["Korean", "English"],
      "specializes_in": ["anxiety", "embarrassment", "workplace stress"],
      "emotions_treated": ["anxiety", "embarrassment", "anger", "sad"],
      "online_available": true,
      "match_score": 0.95,
      "match_reason": "Specializes in workplace anxiety in Korean corporate culture.",
      "matched_concerns": ["anxiety", "workplace stress"],
      "approach_fit": "CBT and mindfulness fit the user's pattern of physical regulation."
    }
  ],
  "total_candidates_evaluated": 20,
  "layer1_filtered": 5,
  "matching_method": "two-layer: mathematical + AI semantic"
}
```

---

## 데이터 스키마

### Pydantic DTO

| Schema | 위치 | 용도 |
|---|---|---|
| `UserOut`, `ProfileUpdate` | [models/user.py](app/models/user.py) | `/auth/me` |
| `DiaryCreate`, `DiaryUpdate`, `DiaryAccepted`, `DiaryListItem`, `DiaryDetail`, `SongOut`, `EmotionScores` | [models/diary.py](app/models/diary.py) | `/diary/*` |
| `DiaryAnalysisLLMResult` | 〃 | Gemini 구조화 출력 (9 float scores + crisis + Solis fields) |
| `ChatMessageIn`, `MessageOut`, `ChatTurnResponse` | [models/chat.py](app/models/chat.py) | 메시지 송수신 |
| `ConversationCreate`, `ConversationSummary`, `ConversationDetail` | 〃 | 대화 CRUD |
| `ReportCreate`, `ReportOut`, `EmotionStat` | [models/report.py](app/models/report.py) | `POST /reports` |
| `ReportLLMResult` | 〃 | Gemini 구조화 출력 (summary 만) |
| `TherapistMatchRequest`, `TherapistMatchResponse`, `TherapistSummary`, `TherapistProfile`, `TherapistMatch`, `TherapistRanking`, `TherapistRankingList` | [models/therapist.py](app/models/therapist.py) | `POST /therapist/match` |

### Enum 값 ([app/core/enums.py](app/core/enums.py))

- `DiaryStatus`: `pending` · `analyzing` · `done` · `failed`
- `Emotion` (9): `joy` · `sad` · `anger` · `anxiety` · `calm` · `embarrassment` · `envy` · `boredom` · `nostalgia`
- `MessageRole`: `user` · `assistant` · `system`
- `EMOTIONS` 튜플도 같이 export

---

## DB 스키마

> 실제 SQL 은 [supabase/schema.sql](supabase/schema.sql). 멱등 스크립트 (재실행 시 therapists ON CONFLICT DO UPDATE 로 갱신).

### 테이블 관계

```
auth.users  (Supabase 관리)
   │ id (uuid)
   │  ON INSERT → trigger handle_new_user()
   ▼
public.profiles
   │ id (uuid, PK, FK→auth.users.id ON DELETE CASCADE)
   │ email, nickname, created_at
   │
   ├──< public.diary_entries
   │      │ id (bigserial, PK)
   │      │ user_id (uuid, FK→profiles.id)
   │      │ entry_date, title, content, status
   │      │ primary_emotion (emotion enum, Gemini가 argmax 반환)
   │      │ scores (jsonb)        — {emotion: float 0-1} 9감정
   │      │ emotion_summary, emotion_model, emotion_raw (jsonb)
   │      │ crisis_score (float), solis_message, suggested_action,
   │      │   needs_hotline (bool NOT NULL default false)
   │      │ songs (jsonb, 현재 항상 null)
   │      │ UNIQUE (user_id, entry_date)
   │
   ├──< public.conversations (diary_entry_id NULLABLE → standalone 가능)
   │      │ id (bigserial, PK), user_id, diary_entry_id (nullable FK), title
   │      │
   │      └──< public.messages
   │            │ conversation_id (FK), role (message_role enum), content
   │
   └──< public.reports
          │ user_id, period_start, period_end
          │ dominant_emotion (emotion enum), summary (text)
          │ mood_chart (jsonb)   — {date: {emotion: float}}
          │ stats (jsonb)        — {emotion: {avg float, peak float, days int}}
          │ UNIQUE (user_id, period_start, period_end)

public.therapists  (no FK — 공용 디렉터리)
   │ therapist_id (varchar PK)
   │ name, location, languages, certifications, approach,
   │ specializes_in, emotions_treated (jsonb arrays)
   │ online_available, in_person_available (bool)
   │ years_experience, education, bio, price_per_session, rating
   │ ── schema.sql 의 jsonb_to_recordset 시드로 20행 삽입 (KR 10 + JP 10)
```

### `public.diary_entries` 핵심 컬럼

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | bigserial PK | |
| `user_id` | uuid FK | profiles.id |
| `entry_date` | date | UNIQUE with user_id |
| `title`, `content` | varchar/text | |
| `status` | `diary_status` enum | pending → analyzing → done / failed |
| `primary_emotion` | `emotion` enum nullable | 9감정 중 argmax (Gemini가 직접 반환) |
| `scores` | jsonb | 9감정 float [0,1] dict |
| `emotion_summary` | text | LLM 1-2문장 요약 |
| `emotion_model` | varchar(100) | 사용된 모델 식별자 |
| `emotion_raw` | jsonb | 디버깅용 LLM 원본 응답 |
| `crisis_score` | double precision | [0,1] 위기 위험도 |
| `solis_message` | text | Solis 의 따뜻한 reflection |
| `suggested_action` | text | 작은 제안 한 줄 |
| `needs_hotline` | bool NOT NULL | crisis_score≥0.8 또는 키워드 매칭 시 true |
| `songs` | jsonb | TBD — 현재 null |
| `created_at`, `updated_at` | timestamptz | |

### Row-Level Security

모든 사용자 테이블에 RLS 활성. 백엔드는 RLS 우회 DB 자격으로 연결하므로 라우터의
`entry.user_id != user.id` 체크가 1차 보안 경계. RLS 는 PostgREST/Supabase JS 클라이언트가
직접 붙을 때를 위한 defense-in-depth.

| Policy | Table | Operation | Rule |
|---|---|---|---|
| `profiles: self read/update` | `profiles` | SELECT/UPDATE | `auth.uid() = id` |
| `diary: self all` | `diary_entries` | ALL | `auth.uid() = user_id` |
| `report: self read/write` | `reports` | SELECT/INSERT | `auth.uid() = user_id` |
| `conv: self all` | `conversations` | ALL | `auth.uid() = user_id` |
| `msg: self read/write` | `messages` | SELECT/INSERT | parent conversation 의 user_id == `auth.uid()` |
| `therapists: authenticated read` | `therapists` | SELECT | `auth.role() = 'authenticated'` |

---

## 디렉터리 구조

```
backend/
├── app/
│   ├── main.py                       # FastAPI 앱 + 라우터 + 로깅 + CORS + rate limit wiring
│   ├── api/
│   │   ├── auth.py                   #   /auth/me
│   │   ├── diary.py                  #   /diary, /diary/{id}/reanalyze
│   │   ├── chat.py                   #   /conversations/*
│   │   ├── report.py                 #   /reports (rate-limited)
│   │   └── therapist.py              #   /therapist/match (rate-limited)
│   ├── core/
│   │   ├── config.py                 # Pydantic Settings (.env)
│   │   ├── dependencies.py           # get_db, get_current_user
│   │   ├── enums.py                  # DiaryStatus · Emotion(9) · MessageRole · EMOTIONS
│   │   ├── security.py               # JWKS + ES256 검증 (HS256 fallback)
│   │   ├── gemini_client.py          # Gemini API 클라이언트 (lru_cache 싱글톤)
│   │   └── rate_limit.py             # slowapi limiter (token tail or IP)
│   ├── db/
│   │   ├── database.py               # 지연 엔진 + SessionLocal
│   │   └── init_db.py                # create_all (schema.sql 권장)
│   ├── entity/                       # SQLAlchemy 2.0 ORM
│   │   ├── base_entity.py
│   │   ├── user_entity.py            # profiles
│   │   ├── diary_entry_entity.py     # 9감정 scores jsonb + Solis fields
│   │   ├── conversation_entity.py    # diary_entry_id nullable, title
│   │   ├── message_entity.py
│   │   ├── report_entity.py          # mood_chart + stats jsonb
│   │   └── therapist_entity.py       # 디렉터리 (jsonb arrays)
│   ├── models/                       # Pydantic DTO
│   │   └── user.py · diary.py · chat.py · report.py · therapist.py
│   ├── repository/
│   │   ├── base_repo.py
│   │   ├── user_repo.py              # upsert_from_supabase
│   │   ├── diary_repo.py             # save_analysis, clear_analysis
│   │   ├── conversation_repo.py      # list_for_user, create
│   │   ├── report_repo.py            # upsert (regenerate)
│   │   └── therapist_repo.py         # list_all, list_by_location_suffix
│   └── services/
│       ├── prompts.py                # 모든 system prompts 한 곳
│       ├── diary_analysis_service.py # Gemini 9감정 float + 위기 키워드 safety net
│       ├── chatbot_service.py        # Gemini 멀티턴 (Solis)
│       ├── report_service.py         # mood_chart/stats 앱 집계 + Gemini summary
│       └── therapist_service.py      # 2-layer 매칭 (math + Gemini response_schema)
├── scripts/
│   └── smoke.sh                      # 배포 후 end-to-end curl 검증
├── supabase/
│   └── schema.sql                    # 테이블 + enum + RLS + therapists 시드
├── .env.example
├── Dockerfile                        # uv 멀티스테이지
└── pyproject.toml
```

## 자주 쓰는 명령

```bash
uv sync
uv run uvicorn app.main:app --reload
uv run ruff format . ; uv run ruff check --fix .
uv add <package>
./scripts/smoke.sh                    # 배포 후 검증
```

## 환경변수 ([.env.example](.env.example) 참고)

| 변수 | 필수 | 비고 |
|---|---|---|
| `SUPABASE_URL` | ✓ | JWKS fetch 에 사용 |
| `SUPABASE_ANON_KEY` | △ | 프론트 위주, 백엔드는 거의 안 씀 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | admin 작업용 |
| `SUPABASE_JWT_SECRET` | ✗ | legacy HS256 fallback (보통 비워둠) |
| `DATABASE_URL` | ✓ | `postgresql+psycopg2://...?sslmode=require` |
| `GEMINI_API_KEY` | ✓ | aistudio.google.com/apikey |
| `GEMINI_MODEL` | ✗ | 기본 `gemini-2.5-flash` |
| `CORS_ORIGINS` | ✗ | 기본 `*`, 프로덕션은 `https://app.example.com` 처럼 명시 |
| `LOG_LEVEL` | ✗ | 기본 `INFO` |

## 현재 미구현 (TBD)

- [x] **Gemini 감정 분석** — 9감정 float [0,1] + crisis_score + Solis reflection
- [x] **Solis 챗봇** — 다중 대화 + standalone 채팅 (Gemini 멀티턴)
- [x] **Gemini 리포트** — 통계는 앱 집계, narrative 만 LLM
- [x] **Therapist 매칭** — 2-layer (수학 + Gemini), DB-resident 디렉터리
- [ ] **노래 추천** — 데이터 출처 결정 (LLM 텍스트 / Spotify / YouTube) 후
      [services/diary_analysis_service.py](app/services/diary_analysis_service.py) 의
      `save_analysis(songs=...)` 인자를 채워야 함. 현재는 항상 null.
- [ ] **Realtime 분석 진행도** — 현재는 폴링. Supabase Realtime 또는 SSE 검토 중.
