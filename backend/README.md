# Backend

FastAPI · SQLAlchemy 2.0 · Pydantic v2 · Supabase (Postgres + Auth) · vLLM · Gemini

> 도메인: 감정 일기장. 사용자가 일기를 쓰면 Gemini 가 5감정 강도(1-10)를 분석,
> CBT-Copilot(vLLM) 챗봇이 일기 또는 standalone 대화를 처리, 기간 리포트를 Gemini 가
> 생성. 인증·DB 는 Supabase 가 호스팅.
> 전체 설계는 [../PLAN.md](../PLAN.md), 작업 규칙은 [../CLAUDE.md](../CLAUDE.md).

## 빠른 시작

### 1) Supabase 준비

1. [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트 → SQL Editor
2. [supabase/schema.sql](supabase/schema.sql) 통째로 붙여넣고 **Run** (멱등 — 여러 번 돌려도 안전)
3. Settings → API 에서 다음을 복사해 `.env` 채우기:
   - Project URL → `SUPABASE_URL`
   - publishable key (`sb_publishable_...`) → `SUPABASE_ANON_KEY`
   - secret key (`sb_secret_...`) → `SUPABASE_SERVICE_ROLE_KEY`
4. Settings → Database → Connection string → **Session Pooler** URI → `DATABASE_URL`
   - `postgresql://` → `postgresql+psycopg2://` 로 바꾸고 `?sslmode=require` 추가
5. (선택) [Google AI Studio](https://aistudio.google.com/apikey) → `GEMINI_API_KEY`

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
| `502 Bad Gateway` | LLM(Gemini/vLLM) 호출 실패 또는 응답 파싱 실패 |

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

일기 단건 + 인라인된 감정 분석 + (TBD) 노래 추천.

**Response 200** — `DiaryDetail` (감정·곡 컬럼이 일기 row 에 인라인됨)
```json
{
  "id": 42,
  "entry_date": "2026-05-17",
  "title": "Today was odd",
  "content": "I felt anxious in the morning but calmer after a walk.",
  "status": "done",
  "primary_emotion": "calm",
  "joy_intensity": 4,
  "sad_intensity": 3,
  "anger_intensity": 2,
  "anxiety_intensity": 6,
  "calm_intensity": 7,
  "emotion_summary": "An anxious morning that settled into a calmer afternoon.",
  "songs": null,
  "created_at": "...",
  "updated_at": "..."
}
```

- `*_intensity` 는 분석 완료(`status=done`) 시 1-10 정수, pending/failed 시 null
- `primary_emotion` 은 5강도 중 argmax (앱이 계산해서 저장)
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

CBT 챗봇 대화 목록. `?diary_id=X` 로 특정 일기에 묶인 것만 필터 가능.

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

CBT-Copilot(vLLM) 동기 호출. user + assistant 메시지 둘 다 저장하고 반환. 응답 1-3 초.

**Request** — `{ "message": "..." }`
**Response 200** — `ChatTurnResponse`
```json
{
  "user_message":      { "role": "user",      "content": "...", "created_at": "..." },
  "assistant_message": { "role": "assistant", "content": "...", "created_at": "..." }
}
```

**Error 502** — vLLM 서버 연결 실패 / 빈 응답.

### `DELETE /conversations/{conversation_id}`

대화 삭제 (메시지 CASCADE). 본인 소유 아니거나 이미 없어도 **204** (멱등).

---

### `POST /reports`

기간 받아 리포트 즉시 생성. 같은 (user, start, end) 조합으로 다시 호출하면 덮어씀.

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
    "2026-05-11": { "joy": 4, "sad": 7, "anger": 2, "anxiety": 6, "calm": 3 },
    "2026-05-12": { "joy": 6, "sad": 4, "anger": 1, "anxiety": 3, "calm": 7 }
  },
  "stats": {
    "joy":     { "avg": 5.2, "peak": 8, "days": 1 },
    "sad":     { "avg": 4.0, "peak": 7, "days": 1 },
    "anger":   { "avg": 1.5, "peak": 2, "days": 0 },
    "anxiety": { "avg": 4.0, "peak": 6, "days": 1 },
    "calm":    { "avg": 5.5, "peak": 8, "days": 4 }
  },
  "model_name": "gemini-2.5-flash",
  "generated_at": "..."
}
```

- `stats.{emotion}.avg` — 기간 내 평균 강도 (1-10)
- `stats.{emotion}.peak` — 기간 내 최대 강도
- `stats.{emotion}.days` — 해당 감정이 primary 였던 일수

**Error 상태**
- `400` — `period_end < period_start`
- `404` — 해당 기간에 분석된 일기 없음
- `502` — Gemini 호출 실패

---

## 데이터 스키마

### Pydantic DTO

| Schema | 위치 | 용도 |
|---|---|---|
| `UserOut`, `ProfileUpdate` | [models/user.py](app/models/user.py) | `/auth/me` |
| `DiaryCreate`, `DiaryUpdate`, `DiaryAccepted`, `DiaryListItem`, `DiaryDetail`, `SongOut` | [models/diary.py](app/models/diary.py) | `/diary/*` |
| `DiaryAnalysisLLMResult` | 〃 | Gemini 구조화 출력 (5 ints + summary) |
| `ChatMessageIn`, `MessageOut`, `ChatTurnResponse` | [models/chat.py](app/models/chat.py) | 메시지 송수신 |
| `ConversationCreate`, `ConversationSummary`, `ConversationDetail` | 〃 | 대화 CRUD |
| `ReportCreate`, `ReportOut`, `EmotionStat` | [models/report.py](app/models/report.py) | `POST /reports` |
| `ReportLLMResult` | 〃 | Gemini 구조화 출력 (summary 만) |

### Enum 값 ([app/core/enums.py](app/core/enums.py))

- `DiaryStatus`: `pending` · `analyzing` · `done` · `failed`
- `Emotion`: `joy` · `sad` · `anger` · `anxiety` · `calm`
- `MessageRole`: `user` · `assistant` · `system`

---

## DB 스키마

> 실제 SQL 은 [supabase/schema.sql](supabase/schema.sql). 멱등 스크립트.

### 테이블 관계

```
auth.users  (Supabase 관리)
   │ id (uuid)
   │
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
   │      │ primary_emotion (emotion enum, app가 argmax로 계산)
   │      │ joy_intensity, sad_intensity, anger_intensity,
   │      │   anxiety_intensity, calm_intensity (int 1-10)
   │      │ emotion_summary, emotion_model, emotion_raw (jsonb)
   │      │ songs (jsonb, 현재 항상 null)
   │      │ UNIQUE (user_id, entry_date)
   │
   ├──< public.conversations (diary_entry_id NULLABLE → standalone 가능)
   │      │ id (bigserial, PK)
   │      │ user_id, diary_entry_id (nullable FK)
   │      │ title (nullable)
   │      │
   │      └──< public.messages
   │            │ conversation_id (FK)
   │            │ role (message_role enum), content
   │
   └──< public.reports
          │ user_id, period_start, period_end
          │ dominant_emotion (emotion enum)
          │ summary (text)
          │ mood_chart (jsonb)   — {date: {emotion: intensity}}
          │ stats (jsonb)        — {emotion: {avg, peak, days}}
          │ UNIQUE (user_id, period_start, period_end)
```

### `public.diary_entries` 핵심 컬럼

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | bigserial PK | |
| `user_id` | uuid FK | profiles.id |
| `entry_date` | date | UNIQUE with user_id |
| `title`, `content` | varchar/text | |
| `status` | `diary_status` enum | pending → analyzing → done / failed |
| `primary_emotion` | `emotion` enum nullable | 5강도 중 argmax (앱이 계산해서 저장) |
| `joy_intensity` … `calm_intensity` | int (CHECK 1-10) | 분석 완료 시 채움, 그 외 null |
| `emotion_summary` | text | LLM 1-문장 요약 |
| `emotion_model` | varchar(100) | 사용된 모델 식별자 |
| `emotion_raw` | jsonb | 디버깅용 LLM 원본 응답 |
| `songs` | jsonb | TBD — 현재 null |
| `created_at`, `updated_at` | timestamptz | |

### Row-Level Security

모든 사용자 테이블에 RLS 활성. 격리는 DB 가 수행.

| Policy | Table | Operation | Rule |
|---|---|---|---|
| `profiles: self read/update` | `profiles` | SELECT/UPDATE | `auth.uid() = id` |
| `diary: self all` | `diary_entries` | ALL | `auth.uid() = user_id` |
| `report: self read/write` | `reports` | SELECT/INSERT | `auth.uid() = user_id` |
| `conv: self all` | `conversations` | ALL | `auth.uid() = user_id` |
| `msg: self read/write` | `messages` | SELECT/INSERT | parent conversation 의 user_id == `auth.uid()` |

> `service_role` 키로 접속하면 RLS 우회 — 백엔드 admin 작업용.

---

## 디렉터리 구조

```
backend/
├── app/
│   ├── main.py                       # FastAPI 앱 + 라우터 wiring
│   ├── api/
│   │   ├── auth.py                   #   /auth/me
│   │   ├── diary.py                  #   /diary, /diary/{id}/reanalyze
│   │   ├── chat.py                   #   /conversations/*
│   │   └── report.py                 #   /reports
│   ├── core/
│   │   ├── config.py                 # Pydantic Settings (.env)
│   │   ├── dependencies.py           # get_db, get_current_user
│   │   ├── enums.py                  # DiaryStatus · Emotion · MessageRole
│   │   ├── security.py               # JWKS + ES256 검증 (HS256 fallback)
│   │   ├── llm_client.py             # vLLM OpenAI-호환 (CBT-Copilot)
│   │   └── gemini_client.py          # Gemini API 클라이언트
│   ├── db/
│   │   ├── database.py               # 지연 엔진 + SessionLocal
│   │   └── init_db.py                # create_all (schema.sql 권장)
│   ├── entity/                       # SQLAlchemy 2.0 ORM
│   │   ├── base_entity.py
│   │   ├── user_entity.py            # profiles
│   │   ├── diary_entry_entity.py     # 감정 강도 컬럼 인라인
│   │   ├── conversation_entity.py    # diary_entry_id nullable, title
│   │   ├── message_entity.py
│   │   └── report_entity.py          # stats 컬럼 포함
│   ├── models/                       # Pydantic DTO
│   │   └── user.py · diary.py · chat.py · report.py
│   ├── repository/
│   │   ├── base_repo.py
│   │   ├── user_repo.py              # upsert_from_supabase
│   │   ├── diary_repo.py             # save_analysis, clear_analysis
│   │   ├── conversation_repo.py      # list_for_user, create
│   │   └── report_repo.py            # upsert (regenerate)
│   └── services/
│       ├── diary_analysis_service.py # Gemini emotion intensities (1-10)
│       ├── chatbot_service.py        # CBT-Copilot 멀티턴 (diary-bound or standalone)
│       └── report_service.py         # mood_chart/stats 앱 집계 + Gemini summary
├── supabase/
│   └── schema.sql                    # 테이블 + 트리거 + RLS
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
```

## 현재 미구현 (TBD)

- [x] **Gemini 감정 분석** — 5감정 강도(1-10) 추출 + primary 앱 계산
- [x] **CBT-Copilot 챗봇** — 다중 대화 + standalone 채팅 지원
- [x] **Gemini 리포트** — 통계는 앱 집계, narrative 만 LLM
- [ ] **노래 추천** — 데이터 출처 결정 (LLM 텍스트 / Spotify / YouTube) 후
      [services/diary_analysis_service.py](app/services/diary_analysis_service.py) 의
      `songs=` 파라미터를 채워야 함. 현재는 항상 null.
