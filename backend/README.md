# Backend

FastAPI · SQLAlchemy 2.0 · Pydantic v2 · Supabase (Postgres + Auth) · vLLM · Gemini

> 도메인: 감정 일기장. 사용자가 일기를 쓰면 vLLM(CBT-Copilot)이 분석/대화,
> Gemini가 주간 리포트를 생성. 인증·DB는 Supabase가 호스팅.
> 전체 설계는 [../PLAN.md](../PLAN.md), 작업 규칙은 [../CLAUDE.md](../CLAUDE.md).

## 빠른 시작

### 1) Supabase 준비

1. [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트 → SQL Editor
2. [supabase/schema.sql](supabase/schema.sql) 통째로 붙여넣고 **Run**
3. Settings → API에서 다음 4개 값 복사:
   - Project URL → `SUPABASE_URL`
   - `anon` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
   - JWT Secret → `SUPABASE_JWT_SECRET`
4. Settings → Database → Connection string → URI 복사 (Direct connection) → `DATABASE_URL`
   - `postgresql://` → `postgresql+psycopg2://`로 바꾸고 `?sslmode=require` 추가

### 2) 로컬 실행

```bash
cp .env.example .env       # 1)에서 복사한 값들 채우기
uv sync                    # Python 3.11+ + 의존성 (.venv/ 자동 생성)
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API: http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- OpenAPI JSON: http://localhost:8000/openapi.json

### 3) 인증 토큰 얻기

회원가입/로그인은 **백엔드를 거치지 않습니다**. Supabase 클라이언트(또는 임시로 curl)로
직접 토큰을 받아야 합니다.

```bash
# 회원가입 (이메일 인증 미설정 시 즉시 access_token 반환)
curl -X POST "$SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"hackathon123"}'

# 로그인
curl -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"hackathon123"}'
# → {"access_token": "...", ...}
```

이 `access_token`을 모든 백엔드 호출의 `Authorization: Bearer <token>`에 사용.

---

## API 레퍼런스

> 모든 사용자 데이터 엔드포인트는 `Authorization: Bearer <supabase access_token>` 필요.
> 토큰 없거나 만료되면 **401**.

### 공통

| Status | When |
|---|---|
| `401 Unauthorized` | 토큰 없음·만료·서명 불일치 |
| `404 Not Found` | 해당 리소스 없거나 본인 소유 아님 |
| `409 Conflict` | 중복 (예: 같은 날짜에 이미 일기 존재) |
| `422 Unprocessable Entity` | Pydantic 검증 실패 |

### `GET /health`

헬스체크. 인증 불필요.

**Response 200**
```json
{ "status": "ok" }
```

---

### `GET /auth/me`

현재 사용자의 프로필 조회. 토큰 첫 사용 시 `profiles` 행이 자동 생성됨.

**Response 200** — `UserOut`
```json
{
  "id": "a8e7b1c4-...-uuid",
  "email": "test@example.com",
  "nickname": null,
  "created_at": "2026-05-16T12:34:56Z"
}
```

### `PATCH /auth/me`

프로필 업데이트 (현재는 닉네임만).

**Request** — `ProfileUpdate`
```json
{ "nickname": "alice" }
```

**Response 200** — `UserOut`

---

### `POST /diary`

일기 작성. 백그라운드로 감정 분석이 트리거된다. 같은 날짜에 이미 일기가 있으면 409.

**Request** — `DiaryCreate`
```json
{
  "entry_date": "2026-05-16",
  "title": "Today was odd",
  "content": "I felt anxious in the morning but calmer after talking to a friend..."
}
```

**Response 202** — `DiaryAccepted`
```json
{
  "entry_id": 42,
  "entry_date": "2026-05-16",
  "status": "pending"
}
```

### `GET /diary?year=2026&month=5`

캘린더 월간 뷰. 해당 월의 본인 일기 한 줄 요약 리스트.

**Query**
- `year` (int, 2020–2100)
- `month` (int, 1–12)

**Response 200** — `list[DiaryListItem]`
```json
[
  { "entry_id": 1, "entry_date": "2026-05-01", "primary_emotion": "calm", "status": "done" },
  { "entry_id": 2, "entry_date": "2026-05-16", "primary_emotion": null,   "status": "analyzing" }
]
```

### `GET /diary/{entry_id}`

일기 단건 + 분석 결과 + 노래 추천.

**Response 200** — `DiaryDetail`
```json
{
  "id": 42,
  "entry_date": "2026-05-16",
  "title": "Today was odd",
  "content": "I felt anxious...",
  "status": "done",
  "created_at": "2026-05-16T12:34:56Z",
  "updated_at": "2026-05-16T12:35:10Z",
  "analysis": {
    "primary_emotion": "calm",
    "scores": { "joy": 0.2, "sad": 0.2, "anger": 0.0, "anxiety": 0.0, "calm": 0.6 },
    "summary": "..."
  },
  "songs": [
    { "rank": 1, "title": "Yellow", "artist": "Coldplay", "reason": "...", "external_url": null }
  ]
}
```

> 현재 vLLM 미연동 — `analysis`는 placeholder 결과, `songs`는 빈 배열.

### `PUT /diary/{entry_id}`

본문/제목 수정. 본문이 바뀌면 재분석이 백그라운드로 큐잉되고 `status`가 `pending`으로 돌아감.

**Request** — `DiaryUpdate` (모든 필드 optional)
```json
{ "title": "Better title", "content": "Updated thoughts..." }
```

**Response 200** — `DiaryAccepted`

### `DELETE /diary/{entry_id}`

일기 삭제 (CASCADE로 `emotion_analyses`, `song_recommendations`도 함께 삭제).

**Response 204** — body 없음

### `POST /diary/{entry_id}/reanalyze`

분석 수동 재시작 (`failed` 상태이거나 모델 바뀐 뒤 다시 돌릴 때).

**Response 202** — `DiaryAccepted`

---

### `POST /reports`

기간(시작일·종료일)을 받아 Gemini 가 즉시 리포트를 생성. 동기 호출이라 응답까지
**수 초 걸림** (로딩 스피너 권장). 같은 기간을 다시 호출하면 결과를 덮어쓰기.

**Request** — `ReportCreate`
```json
{
  "period_start": "2026-05-11",
  "period_end":   "2026-05-17"
}
```

**Response 200** — `ReportOut`
```json
{
  "period_start": "2026-05-11",
  "period_end":   "2026-05-17",
  "dominant_emotion": "calm",
  "summary": "You navigated a tense Monday and gradually found steadier ground...",
  "mood_chart": {
    "2026-05-11": { "joy": 0.2, "sad": 0.1, "anger": 0.0, "anxiety": 0.5, "calm": 0.2 },
    "2026-05-12": { ... }
  },
  "model_name": "gemini-2.5-flash",
  "generated_at": "2026-05-18T08:15:30Z"
}
```

**Error 상태**
- `400` — `period_end < period_start`
- `404` — 해당 기간에 일기가 한 건도 없음
- `502` — Gemini 호출 실패 또는 응답 JSON 파싱 실패

---

## 데이터 스키마

### Pydantic (요청/응답 DTO)

| Schema | 위치 | 용도 |
|---|---|---|
| `UserOut` | [models/user.py](app/models/user.py) | `GET/PATCH /auth/me` 응답 |
| `ProfileUpdate` | 〃 | `PATCH /auth/me` 요청 |
| `DiaryCreate` | [models/diary.py](app/models/diary.py) | `POST /diary` 요청 |
| `DiaryUpdate` | 〃 | `PUT /diary/{id}` 요청 |
| `DiaryAccepted` | 〃 | 작성·수정·재분석 응답 (202) |
| `DiaryListItem` | 〃 | `GET /diary?year&month` 항목 |
| `DiaryDetail` | 〃 | `GET /diary/{id}` 응답 |
| `EmotionResult` | [models/emotion.py](app/models/emotion.py) | LLM 구조화 출력 (내부) |
| `EmotionAnalysisOut` | 〃 | `DiaryDetail.analysis` |
| `EmotionScores` | 〃 | 5개 감정 점수 (합 1.0) |
| `SongRecOut` | [models/song.py](app/models/song.py) | `DiaryDetail.songs` 항목 |
| `ReportCreate` | [models/report.py](app/models/report.py) | `POST /reports` 요청 |
| `ReportOut` | 〃 | `POST /reports` 응답 |
| `ReportLLMResult` | 〃 | Gemini 구조화 출력 강제용 (내부) |

#### enum 값

- `DiaryStatus`: `pending` · `analyzing` · `done` · `failed`
- `Emotion`: `joy` · `sad` · `anger` · `anxiety` · `calm`

---

## DB 스키마

> 실제 스키마는 [supabase/schema.sql](supabase/schema.sql) 참조. 멱등 스크립트.

### 테이블 관계

```
auth.users (Supabase 관리)
   │ id (uuid)
   │ email, encrypted_password, ...
   │
   │  ON INSERT → trigger handle_new_user()
   ▼
public.profiles
   │ id (uuid, PK, FK→auth.users.id ON DELETE CASCADE)
   │ email, nickname, created_at
   │
   ├──< public.diary_entries
   │      │ id (bigserial, PK)
   │      │ user_id (uuid, FK→profiles.id ON DELETE CASCADE)
   │      │ entry_date (date), title, content, status (enum)
   │      │ created_at, updated_at
   │      │ UNIQUE (user_id, entry_date)
   │      │
   │      ├──< public.emotion_analyses (1:1)
   │      │     │ entry_id (FK, UNIQUE)
   │      │     │ primary_emotion (enum), scores (jsonb), summary
   │      │     │ model_name, raw_response (jsonb)
   │      │
   │      └──< public.song_recommendations (1:N)
   │            │ entry_id (FK)
   │            │ rank, title, artist, reason, external_url
   │
   └──< public.reports
          │ id (bigserial, PK)
          │ user_id (uuid, FK→profiles.id)
          │ period_start, period_end (date)
          │ dominant_emotion (enum), summary, mood_chart (jsonb)
          │ model_name, generated_at
          │ UNIQUE (user_id, period_start, period_end)
```

### 컬럼 상세

#### `public.profiles`
| 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|
| `id` | uuid | PK, FK→`auth.users.id`, ON DELETE CASCADE | Supabase Auth와 1:1 |
| `email` | varchar(255) | nullable | auth.users 트리거가 자동 동기 |
| `nickname` | varchar(50) | nullable | 사용자 설정 |
| `created_at` | timestamptz | default `now()` | |

#### `public.diary_entries`
| 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|
| `id` | bigserial | PK | |
| `user_id` | uuid | FK→`profiles.id`, indexed | |
| `entry_date` | date | indexed | UNIQUE with user_id |
| `title` | varchar(200) | nullable | |
| `content` | text | NOT NULL | |
| `status` | `diary_status` enum | default `'pending'` | pending/analyzing/done/failed |
| `created_at`, `updated_at` | timestamptz | server defaults | |

#### `public.emotion_analyses`
| 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|
| `id` | bigserial | PK | |
| `entry_id` | bigint | FK→`diary_entries.id`, UNIQUE | 1:1 |
| `primary_emotion` | `emotion` enum | NOT NULL | |
| `scores` | jsonb | NOT NULL | `{"joy":0.7, ...}` 합 1.0 |
| `summary` | text | NOT NULL | LLM 요약 |
| `model_name` | varchar(100) | nullable | 사용된 모델 식별자 |
| `raw_response` | jsonb | nullable | 디버깅용 LLM 원 응답 |

#### `public.song_recommendations`
| 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|
| `id` | bigserial | PK | |
| `entry_id` | bigint | FK→`diary_entries.id`, indexed | |
| `rank` | int | NOT NULL | 1부터 |
| `title`, `artist` | varchar(200) | NOT NULL | |
| `reason` | text | nullable | |
| `external_url` | varchar(500) | nullable | Spotify/YouTube 링크 |

#### `public.reports`
| 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|
| `id` | bigserial | PK | |
| `user_id` | uuid | FK→`profiles.id`, indexed | |
| `period_start`, `period_end` | date | NOT NULL | UNIQUE with user_id (period_start, period_end) |
| `dominant_emotion` | `emotion` enum | NOT NULL | |
| `summary` | text | NOT NULL | Gemini가 생성한 narrative (3~5문장) |
| `mood_chart` | jsonb | NOT NULL | `{date: {emotion: score}}` |
| `model_name` | varchar(100) | nullable | 사용된 Gemini 모델 식별자 |
| `generated_at` | timestamptz | default `now()`, upsert 시 갱신 | |

### Row-Level Security (RLS)

모든 사용자 테이블에 RLS 활성화. 핵심 격리는 DB가 수행 (`auth.uid() = user_id`).
백엔드의 `entry.user_id != user.id` 체크는 2차 안전장치.

| Policy | Table | Operation | Rule |
|---|---|---|---|
| `profiles: self read/update` | `profiles` | SELECT/UPDATE | `auth.uid() = id` |
| `diary: self all` | `diary_entries` | ALL | `auth.uid() = user_id` |
| `analysis: self read` | `emotion_analyses` | SELECT | parent diary 의 user_id == `auth.uid()` |
| `songs: self read` | `song_recommendations` | SELECT | 〃 |
| `report: self read` | `reports` | SELECT | `auth.uid() = user_id` |
| `report: self write` | `reports` | INSERT | `auth.uid() = user_id` |

> `service_role` 키로 접속하면 RLS 우회 — 백엔드 admin 작업(분석 결과 INSERT 등)에서 사용.

---

## 디렉터리 구조

```
backend/
├── app/
│   ├── main.py                  # FastAPI 앱 + 라우터 wiring
│   ├── api/                     # 라우터 (얇게 유지)
│   │   ├── auth.py              #   GET/PATCH /me
│   │   ├── diary.py             #   POST/GET/PUT/DELETE /diary, /reanalyze
│   │   └── report.py            #   POST /reports
│   ├── core/
│   │   ├── config.py            # Pydantic Settings (.env 로딩)
│   │   ├── dependencies.py      # get_db, get_current_user (Supabase JWT)
│   │   ├── security.py          # verify_supabase_token
│   │   ├── llm_client.py        # vLLM OpenAI-호환 클라이언트 (CBT-Copilot)
│   │   └── gemini_client.py     # Gemini API 클라이언트 (리포트)
│   ├── db/
│   │   ├── database.py          # 지연 엔진 + SessionLocal
│   │   └── init_db.py           # create_all 부트스트랩 (schema.sql 권장)
│   ├── entity/                  # SQLAlchemy 2.0 ORM
│   │   ├── base_entity.py
│   │   ├── user_entity.py            # profiles 테이블
│   │   ├── diary_entry_entity.py
│   │   ├── emotion_analysis_entity.py
│   │   ├── song_recommendation_entity.py
│   │   └── report_entity.py
│   ├── models/                  # Pydantic DTO
│   │   ├── user.py · diary.py · emotion.py · song.py · report.py
│   ├── repository/              # SQLAlchemy CRUD 추상화
│   │   ├── base_repo.py
│   │   ├── user_repo.py              # upsert_from_supabase
│   │   ├── diary_repo.py
│   │   ├── emotion_repo.py
│   │   ├── song_repo.py
│   │   └── report_repo.py            # upsert (regenerate)
│   └── services/
│       ├── diary_service.py     # 분석 트리거 (현재 stub)
│       ├── report_service.py    # Gemini 리포트 생성 오케스트레이션
│       └── chat_service/        # LangGraph 자리 (graph/prompts/types)
├── supabase/
│   └── schema.sql               # 테이블 + 트리거 + RLS (Dashboard에 붙여넣기)
├── .env.example
├── Dockerfile                   # uv 멀티스테이지
└── pyproject.toml               # uv 의존성·ruff·pytest 설정
```

## 자주 쓰는 명령

```bash
uv sync                                       # 의존성 설치 + .venv 생성
uv run uvicorn app.main:app --reload          # 개발 서버
uv run python -m app.db.init_db               # create_all (schema.sql 대체용)
uv run ruff format . ; uv run ruff check --fix .
uv add <package>                              # 의존성 추가
uv add --dev <package>                        # dev 그룹
```

## 현재 미구현 (TBD)

- [ ] vLLM 연결 — `services/diary_service.py` 가 placeholder 반환 중
- [ ] LangGraph 노드 — `services/chat_service/graph.py` 자리만 있음
- [ ] CBT-Copilot 챗봇 (대화 기능, 라우터 자체가 아직 없음)
- [x] **Gemini 리포트 — 연동 완료** (`POST /reports`, GEMINI_API_KEY 필요)
- [ ] 노래 추천 데이터 출처 결정
- [ ] 감정 분류 모델 결정
