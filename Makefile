TAG ?= latest
RELEASE_PLATFORM ?= linux/amd64

.PHONY: up down release-front

up:
	docker compose up --build -d --wait

down:
	docker compose down

release-front:
	docker buildx build --platform "$(RELEASE_PLATFORM)" --tag "xpat23/livelogs-front:$(TAG)" --push .
