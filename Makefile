.PHONY: up down build logs ps backend-shell backend-sync backend-dev frontend-dev fmt

# --- Docker Compose ---
up:
	docker-compose up -d

down:
	docker-compose down

build:
	docker-compose build

logs:
	docker-compose logs -f

ps:
	docker-compose ps

backend-shell:
	docker-compose exec backend /bin/bash

# --- Local dev (uv) ---
backend-sync:
	cd backend && uv sync

backend-dev:
	cd backend && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend-dev:
	cd frontend && npm run dev

fmt:
	cd backend && uv run ruff format . && uv run ruff check --fix .
