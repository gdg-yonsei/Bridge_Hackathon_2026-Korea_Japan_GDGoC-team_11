# CLAUDE.md

이 파일은 Claude Code가 본 저장소에서 작업할 때 반드시 참고해야 하는
프로젝트 컨텍스트와 규칙을 담습니다.

## 프로젝트 개요

- **이름**: 미정 (Bridge Hackathon 2026 · Korea·Japan GDGoC Team 1)
- **도메인**: 감정 일기장 — 사용자가 일기를 쓰면 vLLM이 감정을 분석하고
  캘린더에 색으로 표시, 요약·노래 추천·주간 리포트를 자동 생성하는 서비스.
- **상세 설계**: [PLAN.md](PLAN.md) 참고. 데이터 모델, LangGraph 구성,
  API 엔드포인트, 프론트 페이지 구조가 모두 그 안에 있음.

## 기술 스택

| 영역 | 기술 |
|---|---|
| Backend | FastAPI · SQLAlchemy 2.0 · Pydantic v2 · LangGraph |
| LLM | vLLM (OpenAI 호환 API, base_url만 교체) |
| DB | PostgreSQL 16 |
| Frontend | Next.js 14 (App Router) · TypeScript · TailwindCSS |
| Infra | Docker Compose · uv (Python 의존성 관리) |

## 도메인 모델 요약

```
users ── diary_entries ── emotion_analyses (1:1)
                       └─ song_recommendations (1:N)
       └─ weekly_reports
```

상세 컬럼은 [PLAN.md §3](PLAN.md#3-데이터-모델) 참고.

## 디렉터리 컨벤션

- `backend/app/entity/` — SQLAlchemy ORM 클래스 (DB 매핑)
- `backend/app/models/` — Pydantic 스키마 (API DTO)
- `backend/app/repository/` — ORM 기반 CRUD 추상화
- `backend/app/services/` — 비즈니스 로직, 외부 API, LLM 호출
- `backend/app/services/chat_service/` — LangGraph 그래프 정의 (감정 분석 그래프)
- `backend/app/api/` — HTTP 라우팅 (얇게 유지)
- `backend/app/worker/` — 백그라운드 잡 (분석 트리거, 주간 리포트 생성)

## 작업 규칙 (반드시 지킬 것)

### ❌ Linear 사용 금지

**리니어(Linear)로 어떤 것도 생성하지 말 것.** 이슈, 프로젝트, 브랜치, 코멘트,
라벨, 사이클 등 일체의 생성·저장 동작 금지. 우회로(외부 API, MCP 도구 등)도
사용 금지.

- `mcp__claude_ai_Linear__save_*`, `create_*` 류 도구 호출 절대 금지
- 브랜치는 항상 git 로컬로만 (`git checkout -b ...`)
- 사용자가 "리니어에 만들어"라고 **명시적으로** 요청하지 않는 한 어떤 경우에도
  Linear에 쓰는 작업을 시도하지 말 것
- 단순 조회(`get_*`, `list_*`)도 사용자가 먼저 요청했을 때만 허용

### 의존성·환경

- Python 의존성은 `backend/pyproject.toml` + `uv`로만 관리 (pip 직접 사용 X)
- 새 의존성 추가: `cd backend && uv add <pkg>` / dev는 `uv add --dev <pkg>`
- 코드 실행: `cd backend && uv run uvicorn app.main:app --reload`
- 의존성 바꾸면 `uv.lock`도 함께 커밋

### 코드 스타일

- 백엔드 포맷·린트: `uv run ruff format . && uv run ruff check --fix .`
- 함수·변수는 snake_case, 클래스는 PascalCase (Python)
- TypeScript는 카멜케이스, 컴포넌트는 PascalCase, 파일명은 kebab-case
- 주석은 *왜*만 적기. 코드가 이미 설명하는 *무엇*은 적지 말 것.

### LLM 호출 규칙

- LLM 직접 호출은 `services/chat_service/` 안에서만
- 라우터(`api/`)에서 LLM 호출 금지 — 반드시 서비스 계층 경유
- 감정 분류 등 구조화 출력이 필요한 호출은 반드시 JSON 스키마 강제
  (`response_format` 또는 vLLM의 `guided_json`) → Pydantic 검증 → DB 저장

### 비동기 처리

- 일기 분석은 항상 비동기 (`POST /diary`는 즉시 `202` 반환,
  LangGraph는 백그라운드 실행)
- 동기로 묶지 말 것 — vLLM 응답 지연으로 UX가 망가짐

## 결정 대기 중인 항목

[PLAN.md §8](PLAN.md#8-결정해야-할-것) 의 8개 결정 사항 중 다음이 미정 상태이며,
정해지기 전엔 해당 영역에 대한 큰 변경 자제:

1. festival/seoul_event 기존 코드 처리 (권장: 일기 도메인으로 전부 갈아엎기)
2. vLLM 호스팅 방식
3. vLLM 모델 선택
4. 분석 트리거 방식 (BackgroundTasks / Celery / asyncio.create_task)
5. 진행 상태 전달 (폴링 / SSE / WebSocket)
6. 노래 데이터 출처 (LLM 텍스트만 / Spotify / YouTube)
7. 일기 수정 시 재분석 정책
8. 인증 필수 여부

## 빠른 명령어 참조

```bash
make up               # 전체 스택 기동
make backend-sync     # uv sync (의존성 설치)
make backend-dev      # 백엔드 dev 서버
make frontend-dev     # 프론트 dev 서버
make fmt              # ruff 포맷+린트
```
