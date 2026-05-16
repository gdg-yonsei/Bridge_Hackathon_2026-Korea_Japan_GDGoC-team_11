# 감정 일기장 — 구현 계획

> Bridge Hackathon 2026 · Korea·Japan GDGoC Team 1
> Stack: FastAPI · PostgreSQL · LangGraph · vLLM · Next.js 14

## 1. 한 줄 요약

사용자가 일기를 쓰면 vLLM이 감정을 분석하고, 결과를 캘린더에 색으로 표시하며,
요약·노래 추천·주간 리포트를 자동 생성하는 서비스.

## 2. 전체 흐름

```
[사용자]           [Frontend]              [Backend]                  [DB]         [vLLM]
   │ 일기 작성        │                         │                         │             │
   │ ───────────────▶│                         │                         │             │
   │                 │  POST /diary            │                         │             │
   │                 │ ───────────────────────▶│                         │             │
   │                 │                         │  INSERT diary (pending) │             │
   │                 │                         │ ───────────────────────▶│             │
   │                 │  202 + entry_id         │                         │             │
   │                 │ ◀───────────────────────│                         │             │
   │                 │                         │  LangGraph 실행          │             │
   │                 │                         │   ├─ 감정 분류 ──────────┼────────────▶│
   │                 │                         │   ├─ 요약 ──────────────┼────────────▶│
   │                 │                         │   └─ 노래 추천 ─────────┼────────────▶│
   │                 │                         │  UPDATE diary (done)    │             │
   │                 │                         │ ───────────────────────▶│             │
   │                 │  GET /diary/{date}      │                         │             │
   │                 │ ◀──────── (poll/SSE) ──▶│                         │             │
   │ 캘린더에서 확인  │                         │                         │             │
   │ ◀───────────────│                         │                         │             │
```

- 분석은 **비동기** (vLLM 응답 ~10초). 저장 즉시 `202 Accepted` 응답 → 백그라운드 LangGraph 실행 → 프론트는 폴링/SSE.
- 동기로 묶으면 저장 버튼이 너무 오래 멈춰서 UX가 나빠짐.

## 3. 데이터 모델

```
users
  id, email, nickname, password_hash, created_at

diary_entries                                # 일기 본문
  id, user_id (FK), entry_date (UNIQUE per user),
  title, content,
  status (pending | analyzing | done | failed),
  created_at, updated_at

emotion_analyses                             # 감정 분석 결과 (1:1 with diary_entry)
  id, entry_id (FK UNIQUE),
  primary_emotion (enum: joy, sad, anger, anxiety, calm, ...),
  scores (JSONB: {joy: 0.7, sad: 0.1, ...}),
  summary (text),
  model_name, raw_response (JSONB),
  created_at

song_recommendations                         # 노래 추천 (1:N)
  id, entry_id (FK), rank,
  title, artist, reason, external_url,
  created_at

weekly_reports                               # 주간 리포트
  id, user_id, week_start (월요일 date), week_end,
  dominant_emotion, summary,
  mood_chart (JSONB: 요일별 감정 점수),
  generated_at
  UNIQUE (user_id, week_start)
```

### entity/ 폴더 재구성

```
entity/
  base_entity.py
  user_entity.py
  diary_entry_entity.py            (신규)
  emotion_analysis_entity.py       (신규)
  song_recommendation_entity.py    (신규)
  weekly_report_entity.py          (신규)
```

기존 `festival_*`, `seoul_event_*`, `conversation_*`, `message_*` 파일은 삭제.

## 4. LangGraph 구성

### Graph A — 일기 분석 (entry 저장 시 트리거)

```
START
  │
  ▼
[load_entry]          DB에서 일기 본문 로드
  │
  ▼
[classify_emotion]    vLLM 호출, JSON schema로 {primary, scores} 응답 강제
  │
  ▼
[summarize]           2~3문장 요약 + 키워드 추출
  │
  ▼
[recommend_songs]     감정/요약을 컨텍스트로 노래 3~5곡 (제목·아티스트·이유)
  │
  ▼
[persist]             emotion_analyses + song_recommendations 저장, status='done'
  │
  ▼
END
```

상태 스키마:

```python
class DiaryAnalysisState(TypedDict):
    entry_id: int
    content: str
    emotion: EmotionResult | None
    summary: str | None
    songs: list[SongRec] | None
    error: str | None
```

각 노드가 실패하면 `status='failed'`로 마킹.
재시도는 `POST /diary/{id}/reanalyze`로 수동 트리거.

### Graph B — 주간 리포트

```
START
  │
  ▼
[load_week_entries]      해당 주 7일치 일기/감정 점수 로드
  │
  ▼
[aggregate_scores]       요일별 감정 점수 평균·차트 데이터 (코드만, LLM 호출 X)
  │
  ▼
[generate_narrative]     vLLM이 "이번 주 당신은…" 톤으로 서술
  │
  ▼
[persist]                weekly_reports 저장
  │
  ▼
END
```

## 5. API 엔드포인트

| 메서드 | 경로 | 설명 | 응답 |
|---|---|---|---|
| `POST` | `/auth/signup` | 회원가입 | `{user_id, access_token}` |
| `POST` | `/auth/login` | 로그인 | `{access_token}` |
| `GET` | `/auth/me` | 현재 사용자 정보 | `{user_id, email, nickname}` |
| `POST` | `/diary` | 일기 작성 → 백그라운드 분석 시작 | `202 {entry_id, status:'pending'}` |
| `GET` | `/diary/{entry_id}` | 단건 조회 (감정·요약·노래 포함) | `{entry, analysis, songs}` |
| `GET` | `/diary?year=2026&month=5` | 캘린더용 월간 리스트 | `[{date, primary_emotion, status}]` |
| `PUT` | `/diary/{entry_id}` | 본문 수정 | `{entry, status:'pending'}` (재분석 트리거) |
| `DELETE` | `/diary/{entry_id}` | 삭제 | `204` |
| `POST` | `/diary/{entry_id}/reanalyze` | 실패/수동 재분석 | `202 {status:'analyzing'}` |
| `GET` | `/diary/{entry_id}/stream` | SSE — 분석 진행 상태 푸시 (선택) | `event-stream` |
| `GET` | `/reports/weekly?week=2026-W20` | 주간 리포트 조회/없으면 생성 | `{week, dominant_emotion, summary, mood_chart}` |
| `GET` | `/health` | 헬스체크 | `{status:'ok'}` |

### 요청/응답 예시

**POST /diary**
```json
// Request
{
  "entry_date": "2026-05-16",
  "title": "오늘",
  "content": "오랜만에 친구를 만나서 좋았다. 그런데 늦게까지 일이 남아 있어서..."
}

// Response (202)
{
  "entry_id": 42,
  "entry_date": "2026-05-16",
  "status": "pending"
}
```

**GET /diary/42**
```json
{
  "entry": {
    "id": 42,
    "entry_date": "2026-05-16",
    "title": "오늘",
    "content": "...",
    "status": "done"
  },
  "analysis": {
    "primary_emotion": "joy",
    "scores": {"joy": 0.62, "anxiety": 0.21, "calm": 0.17},
    "summary": "친구와의 만남에서 기쁨을 느꼈지만 업무 부담이 남아있었다."
  },
  "songs": [
    {"rank": 1, "title": "Yellow", "artist": "Coldplay", "reason": "따뜻한 만남의 여운"},
    {"rank": 2, "title": "...", "artist": "...", "reason": "..."}
  ]
}
```

**GET /diary?year=2026&month=5**
```json
[
  {"date": "2026-05-01", "primary_emotion": "calm",    "status": "done"},
  {"date": "2026-05-02", "primary_emotion": "sad",     "status": "done"},
  {"date": "2026-05-16", "primary_emotion": "joy",     "status": "done"},
  {"date": "2026-05-17", "primary_emotion": null,      "status": "analyzing"}
]
```

### router 파일 재구성

```
api/
  auth.py
  diary.py        (festival.py / seoul_event.py 대체)
  report.py
```

## 6. 프론트엔드

### 페이지 구조

```
app/
  page.tsx                   # 캘린더 (월간 뷰, 감정별 색상)
  diary/
    [date]/page.tsx          # "큰 페이지에 쓰는 창" — 작성·조회 통합
  reports/
    weekly/page.tsx          # 주간 리포트
  login/page.tsx
  signup/page.tsx
```

### 핵심 컴포넌트

```
components/
  emotion-calendar.tsx       # 월간 그리드, 셀 클릭 → /diary/[date]
  diary-editor.tsx           # 풀스크린 에디터 (textarea or tiptap)
  emotion-badge.tsx          # 감정 → 색·이모지 매핑
  analysis-panel.tsx         # 분석 결과(요약 + 점수 막대) 표시
  song-list.tsx              # 추천곡 카드 리스트
  weekly-chart.tsx           # recharts 등 요일별 막대/라인
```

### 감정 → 색 매핑 (예시)

| 감정 | 색 | 이모지 |
|---|---|---|
| joy (기쁨) | `#FFD66B` 노랑 | 😊 |
| sad (슬픔) | `#7AA7E8` 파랑 | 😢 |
| anger (분노) | `#E87A7A` 빨강 | 😠 |
| anxiety (불안) | `#B68AE8` 보라 | 😰 |
| calm (평온) | `#7AE8A2` 초록 | 😌 |
| pending/analyzing | `#D0D0D0` 회색 | ⏳ |

### 캘린더 UX 디테일

- 각 날짜 셀 배경색을 `primary_emotion`으로 채움
- `status='pending'|'analyzing'`이면 회색 + 로딩 점
- 셀 호버 시 작은 미리보기 (요약 한 줄)
- 셀 클릭 → `/diary/[date]` 이동

### 작성 페이지 UX

- 페이지 전체를 채우는 에디터, 상단에 날짜·제목, 하단에 "저장" 버튼
- 저장 시 낙관적으로 캘린더로 돌아가되, 해당 셀은 `analyzing` 상태로 표시
- 분석 완료되면 (폴링 3~5초 간격 또는 SSE) 색이 자동으로 채워짐
- 이미 분석이 끝난 날짜를 다시 열면 본문 + 우측 패널(요약·감정·노래)이 함께 보임

## 7. vLLM 연동

vLLM은 OpenAI 호환 API를 띄우므로 `openai` SDK를 그대로 쓰되 `base_url`만 바꿉니다.

`backend/app/core/llm_client.py`:

```python
from openai import OpenAI
from app.core.config import settings

llm = OpenAI(
    base_url=settings.vllm_base_url,   # e.g. http://vllm:8000/v1
    api_key="EMPTY",                    # vLLM은 키 검증 안 함
)
```

### docker-compose에 vLLM 서비스 추가 (GPU 필요)

```yaml
vllm:
  image: vllm/vllm-openai:latest
  command: --model Qwen/Qwen2.5-7B-Instruct --dtype auto
  ports:
    - "8001:8000"
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

### 구조화 출력

감정 분류는 반드시 JSON으로 받아야 안정적.
vLLM의 `guided_json` 또는 `response_format={"type":"json_object"}` 사용 → Pydantic 모델로 검증 후 DB 저장.

```python
class EmotionResult(BaseModel):
    primary_emotion: Literal["joy", "sad", "anger", "anxiety", "calm"]
    scores: dict[str, float]   # 합이 1.0
```

## 8. 결정해야 할 것

| # | 결정 사항 | 옵션 |
|---|---|---|
| 1 | 기존 festival/seoul_event 코드 | **(권장)** 전부 삭제 후 일기 도메인으로 재구성 / 별도 모듈로 공존 |
| 2 | vLLM 호스팅 | 같은 compose에서 GPU로 / 외부 서버 / OpenAI API로 임시 대체 |
| 3 | vLLM 모델 | Qwen2.5-7B-Instruct / Llama-3.1-8B / 한국어 특화 (EXAONE, KULLM 등) |
| 4 | 분석 트리거 방식 | `BackgroundTasks` (단순) / Celery+Redis (견고) / `asyncio.create_task` |
| 5 | 진행 상태 전달 | 폴링 (쉬움) / SSE (부드러움) / WebSocket (과함) |
| 6 | 노래 데이터 출처 | LLM 텍스트 추천만 / Spotify API 연동 / YouTube 검색 링크 |
| 7 | 일기 수정 시 재분석 | 자동 재실행 / 사용자가 "재분석" 버튼 클릭 |
| 8 | 인증 | JWT 필수 / MVP는 단일 사용자로 생략 |

> 특히 **1·2·3번**이 정해져야 폴더 구조와 의존성을 확정할 수 있음.

## 9. 마일스톤 (제안)

- **M1 — 스켈레톤** (1일): DB 스키마 + entity + repository + 빈 router 4개
- **M2 — 일기 CRUD** (1일): 작성/조회/수정/삭제 + 프론트 작성 페이지
- **M3 — vLLM 연동** (1일): LangGraph A (감정 분류만) + 프론트 결과 표시
- **M4 — 캘린더** (1일): 월간 뷰 + 감정 색상 + 폴링
- **M5 — 요약·노래** (0.5일): LangGraph 노드 2개 추가
- **M6 — 주간 리포트** (1일): Graph B + 리포트 페이지
- **M7 — 인증·배포** (0.5일): JWT + Docker 빌드 확인
