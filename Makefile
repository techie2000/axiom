.PHONY: help build run test clean migrate-up migrate-down docker-up docker-down
.PHONY: docker-main-up docker-main-down docker-dev-up docker-dev-down docker-uat-up docker-uat-down docker-prod-up docker-prod-down
.PHONY: docker-all-up docker-all-down docker-all-status validate-env
.PHONY: lint lint-docs lint-docs-fix lint-all install-hooks
.PHONY: smoke-api smoke-ssi cleanup-stale-translations
.PHONY: portless-setup portless-setup-main portless-setup-dev portless-setup-uat portless-setup-prod
.PHONY: portless-list portless-proxy-start portless-proxy-start-https

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build the backend application
	cd backend && go build -o bin/api cmd/api/main.go

run: ## Run the backend application
	cd backend && go run cmd/api/main.go

test: ## Run tests
	cd backend && go test -v ./...

test-coverage: ## Run tests with coverage
	cd backend && go test -v -coverprofile=coverage.out ./...
	cd backend && go tool cover -html=coverage.out -o coverage.html

clean: ## Clean build artifacts
	rm -rf backend/bin
	rm -rf backend/tmp
	rm -f backend/coverage.out backend/coverage.html

docker-up: ## Start all services with Docker Compose (default/legacy)
	docker-compose up -d

docker-down: ## Stop all services (default/legacy)
	docker-compose down

docker-logs: ## Show logs from all services (default/legacy)
	docker-compose logs -f

# Main branch environment (intraday development/fixes)
docker-main-up: ## Start main branch environment (ports: 48080, 43000, 45432)
	@if command -v bash >/dev/null 2>&1; then \
		bash scripts/ensure-bind-mounts.sh main; \
		bash scripts/upgrade-postgres.sh main --yes; \
	elif command -v pwsh >/dev/null 2>&1; then \
		pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/ensure-bind-mounts.ps1 -Environment main; \
		pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/upgrade-postgres.ps1 -Environment main -Yes; \
	else \
		echo "❌ Neither 'bash' nor 'pwsh' was found. Cannot run bind-mount setup or PostgreSQL upgrade precheck."; \
		exit 1; \
	fi
	docker-compose --env-file .env.main -f docker-compose.main.yml up -d

docker-main-down: ## Stop main branch environment
	docker-compose --env-file .env.main -f docker-compose.main.yml down

docker-main-logs: ## Show logs from main branch environment
	docker-compose --env-file .env.main -f docker-compose.main.yml logs -f

docker-main-restart: ## Restart main branch environment
	@if command -v bash >/dev/null 2>&1; then \
		bash scripts/ensure-bind-mounts.sh main; \
		bash scripts/upgrade-postgres.sh main --yes; \
	elif command -v pwsh >/dev/null 2>&1; then \
		pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/ensure-bind-mounts.ps1 -Environment main; \
		pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/upgrade-postgres.ps1 -Environment main -Yes; \
	else \
		echo "❌ Neither 'bash' nor 'pwsh' was found. Cannot run bind-mount setup or PostgreSQL upgrade precheck."; \
		exit 1; \
	fi
	docker-compose --env-file .env.main -f docker-compose.main.yml restart

# Development environment
docker-dev-up: ## Start development environment (ports: 18080, 13000, 15432)
	@if command -v bash >/dev/null 2>&1; then \
		bash scripts/ensure-bind-mounts.sh dev; \
		bash scripts/upgrade-postgres.sh dev --yes; \
	elif command -v pwsh >/dev/null 2>&1; then \
		pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/ensure-bind-mounts.ps1 -Environment dev; \
		pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/upgrade-postgres.ps1 -Environment dev -Yes; \
	else \
		echo "❌ Neither 'bash' nor 'pwsh' was found. Cannot run bind-mount setup or PostgreSQL upgrade precheck."; \
		exit 1; \
	fi
	docker-compose --env-file .env.dev -f docker-compose.dev.yml up -d

docker-dev-down: ## Stop development environment
	docker-compose --env-file .env.dev -f docker-compose.dev.yml down

docker-dev-logs: ## Show logs from development environment
	docker-compose --env-file .env.dev -f docker-compose.dev.yml logs -f

docker-dev-restart: ## Restart development environment
	@if command -v bash >/dev/null 2>&1; then \
		bash scripts/ensure-bind-mounts.sh dev; \
		bash scripts/upgrade-postgres.sh dev --yes; \
	elif command -v pwsh >/dev/null 2>&1; then \
		pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/ensure-bind-mounts.ps1 -Environment dev; \
		pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/upgrade-postgres.ps1 -Environment dev -Yes; \
	else \
		echo "❌ Neither 'bash' nor 'pwsh' was found. Cannot run bind-mount setup or PostgreSQL upgrade precheck."; \
		exit 1; \
	fi
	docker-compose --env-file .env.dev -f docker-compose.dev.yml restart

# UAT environment
docker-uat-up: ## Start UAT environment (ports: 28080, 23000, 25432)
	@if command -v bash >/dev/null 2>&1; then \
		bash scripts/upgrade-postgres.sh uat --yes; \
	elif command -v pwsh >/dev/null 2>&1; then \
		pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/upgrade-postgres.ps1 -Environment uat -Yes; \
	else \
		echo "❌ Neither 'bash' nor 'pwsh' was found. Cannot run PostgreSQL upgrade precheck."; \
		exit 1; \
	fi
	docker-compose --env-file .env.uat -f docker-compose.uat.yml up -d

docker-uat-down: ## Stop UAT environment
	docker-compose --env-file .env.uat -f docker-compose.uat.yml down

docker-uat-logs: ## Show logs from UAT environment
	docker-compose --env-file .env.uat -f docker-compose.uat.yml logs -f

docker-uat-restart: ## Restart UAT environment
	@if command -v bash >/dev/null 2>&1; then \
		bash scripts/upgrade-postgres.sh uat --yes; \
	elif command -v pwsh >/dev/null 2>&1; then \
		pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/upgrade-postgres.ps1 -Environment uat -Yes; \
	else \
		echo "❌ Neither 'bash' nor 'pwsh' was found. Cannot run PostgreSQL upgrade precheck."; \
		exit 1; \
	fi
	docker-compose --env-file .env.uat -f docker-compose.uat.yml restart

# Production environment
docker-prod-up: ## Start production environment (ports: 38080, 33000, 35432)
	@if command -v bash >/dev/null 2>&1; then \
		bash scripts/upgrade-postgres.sh prod --yes; \
	elif command -v pwsh >/dev/null 2>&1; then \
		pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/upgrade-postgres.ps1 -Environment prod -Yes; \
	else \
		echo "❌ Neither 'bash' nor 'pwsh' was found. Cannot run PostgreSQL upgrade precheck."; \
		exit 1; \
	fi
	docker-compose --env-file .env.prod -f docker-compose.prod.yml up -d

docker-prod-down: ## Stop production environment
	docker-compose --env-file .env.prod -f docker-compose.prod.yml down

docker-prod-logs: ## Show logs from production environment
	docker-compose --env-file .env.prod -f docker-compose.prod.yml logs -f

docker-prod-restart: ## Restart production environment
	@if command -v bash >/dev/null 2>&1; then \
		bash scripts/upgrade-postgres.sh prod --yes; \
	elif command -v pwsh >/dev/null 2>&1; then \
		pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/upgrade-postgres.ps1 -Environment prod -Yes; \
	else \
		echo "❌ Neither 'bash' nor 'pwsh' was found. Cannot run PostgreSQL upgrade precheck."; \
		exit 1; \
	fi
	docker-compose --env-file .env.prod -f docker-compose.prod.yml restart

# All environments
docker-all-up: ## Start all environments (main, dev, uat, prod)
	@echo "Starting main branch environment..."
	@$(MAKE) docker-main-up
	@echo "Starting development environment..."
	@$(MAKE) docker-dev-up
	@echo "Starting UAT environment..."
	@$(MAKE) docker-uat-up
	@echo "Starting production environment..."
	@$(MAKE) docker-prod-up
	@echo "All environments started!"

docker-all-down: ## Stop all environments
	@echo "Stopping main branch environment..."
	@$(MAKE) docker-main-down
	@echo "Stopping development environment..."
	@$(MAKE) docker-dev-down
	@echo "Stopping UAT environment..."
	@$(MAKE) docker-uat-down
	@echo "Stopping production environment..."
	@$(MAKE) docker-prod-down
	@echo "All environments stopped!"

docker-all-status: ## Show status of all environments
	@echo "=== Main Branch Environment ==="
	@docker-compose --env-file .env.main -f docker-compose.main.yml ps || true
	@echo ""
	@echo "=== Development Environment ==="
	@docker-compose --env-file .env.dev -f docker-compose.dev.yml ps || true
	@echo ""
	@echo "=== UAT Environment ==="
	@docker-compose --env-file .env.uat -f docker-compose.uat.yml ps || true
	@echo ""
	@echo "=== Production Environment ==="
	@docker-compose --env-file .env.prod -f docker-compose.prod.yml ps || true

migrate-create: ## Create a new migration (usage: make migrate-create name=create_users_table)
	migrate create -ext sql -dir backend/migrations -seq $(name)

migrate-up: ## Run database migrations (default/dev)
	migrate -path backend/migrations -database "postgresql://axiom:axiom@localhost:5432/axiom?sslmode=disable" up

migrate-down: ## Rollback database migrations (default/dev)
	migrate -path backend/migrations -database "postgresql://axiom:axiom@localhost:5432/axiom?sslmode=disable" down

migrate-force: ## Force migration version (usage: make migrate-force version=1)
	migrate -path backend/migrations -database "postgresql://axiom:axiom@localhost:5432/axiom?sslmode=disable" force $(version)

# Environment-specific migrations
migrate-dev-up: ## Run migrations on development database
	migrate -path backend/migrations -database "postgresql://axiom:axiom_dev_pass@localhost:15432/axiom_dev?sslmode=disable" up

migrate-dev-down: ## Rollback migrations on development database
	migrate -path backend/migrations -database "postgresql://axiom:axiom_dev_pass@localhost:15432/axiom_dev?sslmode=disable" down

migrate-main-up: ## Run migrations on main branch database
	migrate -path backend/migrations -database "postgresql://axiom:axiom_main_pass@localhost:45432/axiom_main?sslmode=disable" up

migrate-main-down: ## Rollback migrations on main branch database
	migrate -path backend/migrations -database "postgresql://axiom:axiom_main_pass@localhost:45432/axiom_main?sslmode=disable" down

migrate-uat-up: ## Run migrations on UAT database
	migrate -path backend/migrations -database "postgresql://axiom:axiom_uat_pass@localhost:25432/axiom_uat?sslmode=disable" up

migrate-uat-down: ## Rollback migrations on UAT database
	migrate -path backend/migrations -database "postgresql://axiom:axiom_uat_pass@localhost:25432/axiom_uat?sslmode=disable" down

migrate-prod-up: ## Run migrations on production database
	migrate -path backend/migrations -database "postgresql://axiom:axiom_prod_pass@localhost:35432/axiom_prod?sslmode=disable" up

migrate-prod-down: ## Rollback migrations on production database
	migrate -path backend/migrations -database "postgresql://axiom:axiom_prod_pass@localhost:35432/axiom_prod?sslmode=disable" down

# PostgreSQL major-version upgrade (data migration)
pg-upgrade-main: ## Migrate main branch PostgreSQL data to the current major version
	@bash scripts/upgrade-postgres.sh main

pg-upgrade-dev: ## Migrate dev PostgreSQL data to the current major version
	@bash scripts/upgrade-postgres.sh dev

pg-upgrade-uat: ## Migrate UAT PostgreSQL data to the current major version
	@bash scripts/upgrade-postgres.sh uat

pg-upgrade-prod: ## Migrate production PostgreSQL data to the current major version
	@bash scripts/upgrade-postgres.sh prod

swagger: ## Generate Swagger documentation
	cd backend && swag init -g cmd/api/main.go -o docs

lint: ## Run linter
	cd backend && golangci-lint run

lint-docs: ## Lint markdown documentation
	@echo "Linting markdown files..."
	@if command -v markdownlint > /dev/null 2>&1; then \
		markdownlint --config .markdownlint.yaml '**/*.md' --ignore node_modules; \
	else \
		echo "❌ markdownlint-cli not installed. Run: make install-tools"; \
		exit 1; \
	fi

lint-docs-fix: ## Auto-fix markdown linting issues
	@echo "Auto-fixing markdown files..."
	@if command -v markdownlint > /dev/null 2>&1; then \
		markdownlint --config .markdownlint.yaml '**/*.md' --ignore node_modules --fix; \
		echo "✅ Markdown auto-fix complete"; \
	else \
		echo "❌ markdownlint-cli not installed. Run: make install-tools"; \
		exit 1; \
	fi

lint-all: lint lint-docs ## Run all linters (Go + Markdown)

fmt: ## Format code
	cd backend && go fmt ./...

install-tools: ## Install development tools
	go install github.com/swaggo/swag/cmd/swag@latest
	go install github.com/golang-migrate/migrate/v4/cmd/migrate@latest
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	@echo "Installing markdownlint-cli..."
	@if command -v npm > /dev/null 2>&1; then \
		npm install -g markdownlint-cli; \
	else \
		echo "⚠️  npm not found. Install Node.js to get markdownlint-cli"; \
	fi

install-hooks: ## Install git hooks for pre-commit validation
	@echo "Installing git hooks..."
	@git config core.hooksPath .githooks
	@chmod +x .githooks/pre-commit
	@echo "✅ Git hooks installed. Pre-commit validation enabled."
	@echo "   To disable: git config --unset core.hooksPath"

validate-env: ## Validate multi-environment setup
	@bash scripts/validate-multi-env.sh

smoke-api: ## Run API smoke checks (usage: make smoke-api [env=dev|uat|prod|all] [check_login=1] [startup_wait=90])
	@pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/smoke-api.ps1 -Environment $${env:-all} -StartupWaitSec $${startup_wait:-90} $$( [ "$${check_login:-0}" = "1" ] && echo "-CheckLogin" )

smoke-ssi: ## Run SSI smoke checks (usage: make smoke-ssi [env=dev|uat|prod] [seed=1] [cleanup=1] [timeout=25])
	@pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/smoke-ssi.ps1 -Environment $${env:-dev} -TimeoutSec $${timeout:-25} $$( [ "$${seed:-0}" = "1" ] && echo "-SeedSmokeData" ) $$( [ "$${cleanup:-0}" = "1" ] && echo "-CleanupSmokeData" )

cleanup-stale-translations: ## Delete stale UI translation rows (usage: make cleanup-stale-translations api=http://localhost:18080 token=<JWT> [whatif=1])
	@pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/cleanup-stale-translations.ps1 -ApiBaseUrl $${api:-http://localhost:18080} -BearerToken "$${token}" $$( [ "$${whatif:-0}" = "1" ] && echo "-WhatIf" )

# Portless — human-friendly .localhost URL aliases (optional developer ergonomics)
portless-setup: ## Register portless aliases for all environments (requires: npm install -g portless)
	@if command -v bash >/dev/null 2>&1; then \
		bash scripts/portless-setup.sh; \
	elif command -v pwsh >/dev/null 2>&1; then \
		pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/portless-setup.ps1; \
	else \
		echo "❌ Neither 'bash' nor 'pwsh' was found. Run scripts/portless-setup.sh or scripts/portless-setup.ps1 directly."; \
		exit 1; \
	fi

portless-setup-main: ## Register portless aliases for the main environment only
	@if command -v bash >/dev/null 2>&1; then \
		bash scripts/portless-setup.sh main; \
	elif command -v pwsh >/dev/null 2>&1; then \
		pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/portless-setup.ps1 -Environments main; \
	fi

portless-setup-dev: ## Register portless aliases for the dev environment only
	@if command -v bash >/dev/null 2>&1; then \
		bash scripts/portless-setup.sh dev; \
	elif command -v pwsh >/dev/null 2>&1; then \
		pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/portless-setup.ps1 -Environments dev; \
	fi

portless-setup-uat: ## Register portless aliases for the UAT environment only
	@if command -v bash >/dev/null 2>&1; then \
		bash scripts/portless-setup.sh uat; \
	elif command -v pwsh >/dev/null 2>&1; then \
		pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/portless-setup.ps1 -Environments uat; \
	fi

portless-setup-prod: ## Register portless aliases for the production environment only
	@if command -v bash >/dev/null 2>&1; then \
		bash scripts/portless-setup.sh prod; \
	elif command -v pwsh >/dev/null 2>&1; then \
		pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/portless-setup.ps1 -Environments prod; \
	fi

portless-list: ## Show currently registered portless aliases
	@portless list 2>/dev/null || echo "portless is not installed or proxy is not running. Run: npm install -g portless"

portless-proxy-start: ## Start the portless proxy (HTTP on port 1355)
	@portless proxy start

portless-proxy-start-https: ## Start the portless proxy with HTTPS (port 443; no port suffix in URLs)
	@portless proxy start --https
