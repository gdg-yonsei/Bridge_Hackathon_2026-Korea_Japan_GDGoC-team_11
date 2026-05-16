# Bridge Hackathon 2026 — Korea·Japan GDGoC

> 프로젝트명: _미정_

**감정 일기장 서비스** (GDGoC Team 1).
사용자가 일기를 쓰면 vLLM이 감정을 분석하고 캘린더에 색으로 표시,
요약·노래 추천·주간 리포트를 자동 생성합니다.

- 상세 설계: [PLAN.md](PLAN.md)
- 작업 규칙·컨벤션: [CLAUDE.md](CLAUDE.md)

## 프로젝트 구조

```
.
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── app/
│       ├── main.py
│       ├── __init__.py
│       ├── api/                       # FastAPI 라우터
│       │   ├── auth.py
│       │   ├── chat.py
│       │   ├── festival.py
│       │   └── seoul_event.py
│       ├── core/                      # 설정·의존성·LLM·보안
│       │   ├── config.py
│       │   ├── dependencies.py
│       │   ├── llm_client.py
│       │   └── security.py
│       ├── db/                        # DB 세션·초기화
│       │   ├── database.py
│       │   └── init_db.py
│       ├── entity/                    # SQLAlchemy ORM 엔티티
│       │   ├── base_entity.py
│       │   ├── conversation_entity.py
│       │   ├── festival_entity.py
│       │   ├── festival_like_entity.py
│       │   ├── message_entity.py
│       │   ├── seoul_event_entity.py
│       │   ├── seoul_event_like_entity.py
│       │   └── user_entity.py
│       ├── models/                    # Pydantic 스키마 (요청/응답 DTO)
│       │   ├── chat.py
│       │   ├── festival.py
│       │   ├── seoul_event.py
│       │   └── user.py
│       ├── repository/                # 데이터 접근 계층
│       │   ├── base_repo.py
│       │   ├── festival_like_repo.py
│       │   ├── festival_repo.py
│       │   ├── seoul_event_like_repo.py
│       │   ├── seoul_event_repo.py
│       │   └── user_repo.py
│       ├── services/                  # 비즈니스 로직
│       │   ├── collect_event.py
│       │   ├── embedding_service.py
│       │   └── chat_service/          # LangGraph 기반 챗봇 그래프
│       │       ├── __init__.py
│       │       ├── graph.py
│       │       ├── prompts.py
│       │       └── types.py
│       └── worker/                    # 백그라운드 작업
│           ├── collect_event_worker.py
│           └── embedding_processor.py
│
├── frontend/
│   ├── Dockerfile
│   ├── next.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── eslint.config.mjs
│   ├── postcss.config.mjs
│   ├── app/                           # Next.js App Router
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── liked/
│   │   │   └── page.tsx
│   │   └── signup/
│   │       └── page.tsx
│   ├── components/                    # 공용 UI 컴포넌트
│   │   ├── chat-bot.tsx
│   │   ├── event-calendar.tsx
│   │   ├── event-list.tsx
│   │   ├── header.tsx
│   │   └── login-modal.tsx
│   ├── contexts/                      # React Context (전역 상태)
│   │   └── auth-context.tsx
│   ├── lib/                           # API 클라이언트·정적 데이터
│   │   ├── api.ts
│   │   └── events-data.ts
│   └── public/
│       └── logo.png
│
├── docker-compose.yml
├── Makefile
├── PLAN.md                            # 시스템 설계·데이터 모델·API 스펙
├── CLAUDE.md                          # 작업 규칙·컨벤션
├── CHANGES_SUMMARY.md                 # 변경 이력 요약
└── README.md
```

## 빠른 시작 (Docker)

```bash
make up        # 전체 스택 기동 (backend + frontend + db)
make logs      # 로그 확인
make down      # 종료
```

- Backend API: http://localhost:8000 (Swagger: `/docs`)
- Frontend: http://localhost:3000

## 로컬 개발

### Backend — `uv` 사용

[uv](https://docs.astral.sh/uv/) 가 설치되어 있어야 합니다. 가상환경과 의존성은
모두 `backend/pyproject.toml` 한 곳에서 관리됩니다 (`uv sync`가 `.venv/`를 자동 생성).

```bash
cd backend
uv sync                                            # .venv 생성 + 의존성 설치
uv run uvicorn app.main:app --reload --port 8000   # 개발 서버 (자동 리로드)

uv add httpx                                        # 의존성 추가
uv add --dev pytest                                 # dev 그룹에 추가
uv run pytest                                       # 테스트
uv run ruff format . && uv run ruff check --fix .   # 포맷·린트
```

> `uv sync`는 `uv.lock`을 기준으로 재현 가능한 환경을 만듭니다. 의존성을
> 바꾸면 `uv.lock`이 갱신되니 함께 커밋해 주세요.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## 기술 스택

| 영역 | 기술 |
|------|------|
| Backend | FastAPI · SQLAlchemy 2.0 · Pydantic v2 · LangGraph |
| Frontend | Next.js 14 (App Router) · TypeScript · TailwindCSS |
| Database | PostgreSQL 16 |
| Infra | Docker Compose |

## 디렉터리 컨벤션

- **entity/**: DB 테이블에 매핑되는 ORM 클래스
- **models/**: API 입출력에 쓰이는 Pydantic 스키마 (DTO)
- **repository/**: ORM을 통한 CRUD 추상화
- **services/**: 비즈니스 로직, 외부 API 호출, LLM 처리
- **api/**: HTTP 라우팅만 담당 (얇게 유지)
- **worker/**: 주기적/비동기 백그라운드 잡

## 관련 문서

- [PLAN.md](PLAN.md) — 시스템 설계·데이터 모델·LangGraph·API 스펙
- [CLAUDE.md](CLAUDE.md) — 작업 규칙·컨벤션 (Linear 사용 금지 등)
- [CHANGES_SUMMARY.md](CHANGES_SUMMARY.md) — 주요 변경 사항
