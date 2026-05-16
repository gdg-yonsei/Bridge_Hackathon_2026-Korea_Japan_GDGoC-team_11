# syntax=docker/dockerfile:1.7
FROM python:3.11-slim AS base

# uv 설치 (Astral 공식 이미지에서 단일 바이너리 복사)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PYTHON_DOWNLOADS=never \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /code

# psycopg2-binary 빌드용 시스템 패키지
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 의존성 메타데이터만 먼저 복사해서 캐시 활용
COPY pyproject.toml uv.lock* ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev || \
    uv sync --no-install-project --no-dev

# 앱 코드 복사
COPY app ./app

ENV PATH="/code/.venv/bin:$PATH"

EXPOSE 8000
# Honour $PORT when present (Cloud Run sets it to 8080), else default to 8000.
# Shell form needed for env var substitution; `exec` keeps uvicorn as PID 1 so
# SIGTERM from Cloud Run is delivered cleanly.
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
