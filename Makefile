.PHONY: help build test lint clean docker-build docker-push release

# Variables
VERSION := $(shell cat VERSION)
DOCKER_REGISTRY := ghcr.io
DOCKER_OWNER := techie2000
PROJECT_NAME := axiom

# Component-specific variables
CSV2JSON_IMAGE := $(DOCKER_REGISTRY)/$(DOCKER_OWNER)/csv2json
CANONICALIZER_IMAGE := $(DOCKER_REGISTRY)/$(DOCKER_OWNER)/canonicalizer

# Go build variables
GOOS := $(shell go env GOOS)
GOARCH := $(shell go env GOARCH)
CGO_ENABLED := 0

help: ## Display this help message
	@echo "Axiom - Enterprise Reference Data Platform"
	@echo ""
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

build: ## Build all Go components
	@echo "Building csv2json..."
	cd csv2json && CGO_ENABLED=$(CGO_ENABLED) GOOS=$(GOOS) GOARCH=$(GOARCH) go build -v -o ../bin/csv2json ./main.go
	@echo "Building canonicalizer..."
	cd canonicalizer && CGO_ENABLED=$(CGO_ENABLED) GOOS=$(GOOS) GOARCH=$(GOARCH) go build -v -o ../bin/canonicalizer ./main.go
	@echo "Build complete!"

test: ## Run all tests
	@echo "Running csv2json tests..."
	cd csv2json && go test -v ./...
	@echo "Running canonicalizer tests..."
	cd canonicalizer && go test -v ./...
	@echo "Tests complete!"

lint: ## Run linters on all Go code
	@echo "Running golangci-lint on csv2json..."
	cd csv2json && golangci-lint run
	@echo "Running golangci-lint on canonicalizer..."
	cd canonicalizer && golangci-lint run
	@echo "Linting complete!"

clean: ## Clean build artifacts
	@echo "Cleaning build artifacts..."
	rm -rf bin/
	rm -f csv2json/csv2json
	rm -f canonicalizer/canonicalizer
	@echo "Clean complete!"

docker-build: ## Build all Docker images
	@echo "Building Docker images..."
	docker compose build
	@echo "Docker build complete!"

docker-push: ## Push Docker images to registry
	@echo "Pushing csv2json image..."
	docker tag axiom-csv2json:latest $(CSV2JSON_IMAGE):$(VERSION)
	docker tag axiom-csv2json:latest $(CSV2JSON_IMAGE):latest
	docker push $(CSV2JSON_IMAGE):$(VERSION)
	docker push $(CSV2JSON_IMAGE):latest
	@echo "Pushing canonicalizer image..."
	docker tag axiom-canonicalizer:latest $(CANONICALIZER_IMAGE):$(VERSION)
	docker tag axiom-canonicalizer:latest $(CANONICALIZER_IMAGE):latest
	docker push $(CANONICALIZER_IMAGE):$(VERSION)
	docker push $(CANONICALIZER_IMAGE):latest
	@echo "Docker push complete!"

release: ## Create a new release (update VERSION file first)
	@echo "Creating release $(VERSION)..."
	git tag -a v$(VERSION) -m "Release version $(VERSION)"
	git push origin v$(VERSION)
	@echo "Release $(VERSION) created!"

up: ## Start all services
	docker compose up -d

down: ## Stop all services
	docker compose down

logs: ## View logs from all services
	docker compose logs -f

ps: ## Show running services
	docker compose ps

fmt: ## Format Go code
	@echo "Formatting csv2json..."
	cd csv2json && go fmt ./...
	@echo "Formatting canonicalizer..."
	cd canonicalizer && go fmt ./...
	@echo "Formatting complete!"
