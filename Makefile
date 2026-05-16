.PHONY: backend down

backend:
	mkdir -p backend/logs
	docker-compose up -d --build
	docker-compose logs -f backend | tee backend/logs/backend_$(shell date +%Y%m%d_%H%M%S).log

down:
	docker-compose down
