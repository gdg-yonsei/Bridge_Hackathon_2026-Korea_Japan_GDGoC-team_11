.PHONY: backend down deploy deploy-push deploy-run

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

# ─────────────────────────────────────────────
# Cloud Run deploy — `make deploy` does build → push → redeploy in one go.
# Override any of these on the CLI: `make deploy TAG=v3`
# ─────────────────────────────────────────────
GCP_REGION  ?= asia-northeast3
GCP_PROJECT ?= quantum-feat-467404-s1
GCP_REPO    ?= backend-server
GCP_SERVICE ?= my-app
TAG         ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo latest)
GCP_IMAGE   := $(GCP_REGION)-docker.pkg.dev/$(GCP_PROJECT)/$(GCP_REPO)/$(GCP_SERVICE):$(TAG)

deploy: deploy-push deploy-run

deploy-push:
	@echo "==> building $(GCP_IMAGE)"
	docker build --platform linux/amd64 --load -t $(GCP_IMAGE) ./backend
	@echo "==> pushing $(GCP_IMAGE)"
	docker push $(GCP_IMAGE)

deploy-run:
	@echo "==> deploying $(GCP_SERVICE) in $(GCP_REGION)"
	gcloud run deploy $(GCP_SERVICE) \
		--image=$(GCP_IMAGE) \
		--region=$(GCP_REGION)
