.PHONY: backend down

IMAGE := bridge-backend
CONTAINER := bridge-backend
ENV_FILE := backend/.env
LOG = backend/logs/backend_$(shell date +%Y%m%d_%H%M%S).log

backend:
	mkdir -p backend/logs
	docker build --load -t $(IMAGE) ./backend
	-docker rm -f $(CONTAINER) 2>/dev/null || true
	docker run -d --name $(CONTAINER) \
		$(if $(wildcard $(ENV_FILE)),--env-file $(ENV_FILE),) \
		-p 8000:8000 \
		-v $(CURDIR)/backend/app:/code/app \
		$(IMAGE)
	docker logs -f $(CONTAINER) | tee $(LOG)

down:
	-docker rm -f $(CONTAINER)
