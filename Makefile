.DEFAULT_GOAL := help

.PHONY: help build run test clean migrate-up migrate-down docker-up docker-down
.PHONY: docker-main-up docker-main-down docker-main-rebuild-safe docker-dev-up docker-dev-down docker-dev-rebuild-safe docker-uat-up docker-uat-down docker-uat-rebuild-safe docker-prod-up docker-prod-down docker-prod-rebuild-safe
.PHONY: docker-all-up docker-all-down docker-all-status validate-env
.PHONY: lint lint-docs lint-docs-fix docs-check docs-check-fix lint-all install-hooks settings-sort settings-sort-check
.PHONY: smoke-api smoke-ssi cleanup-stale-translations docs-user-install docs-user-ci-install docs-user-build docs-user-check docs-user-dev

build: ## Build the backend application
	cd backend && go build -o bin/api cmd/api/main.go

calm-validate: ## Validate CALM architecture models (strict)
	@bash scripts/validate-calm.sh

calm-validate-warn: ## Validate CALM architecture models (warn-only)
	@bash scripts/validate-calm.sh --warn

clean: ## Clean build artifacts
	rm -rf backend/bin
	rm -rf backend/tmp
	rm -f backend/coverage.out backend/coverage.html

cleanup-stale-translations: ## Delete stale UI translation rows (usage: make cleanup-stale-translations api=http://localhost:18080 token=<JWT> [whatif=1])
	@pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/cleanup-stale-translations.ps1 -ApiBaseUrl $${api:-http://localhost:18080} -BearerToken "$${token}" $$( [ "$${whatif:-0}" = "1" ] && echo "-WhatIf" )

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

docker-dev-down: ## Stop development environment
	docker-compose --env-file .env.dev -f docker-compose.dev.yml down

docker-dev-rebuild-safe: ## Gracefully rebuild dev backend/frontend while reducing DB crash-recovery risk
	@echo "Gracefully stopping app services first (frontend/backend)..."
	docker-compose --env-file .env.dev -f docker-compose.dev.yml stop -t 45 frontend backend
	@echo "Stopping stateful services with extended timeout (postgres/rabbitmq)..."
	docker-compose --env-file .env.dev -f docker-compose.dev.yml stop -t 120 postgres rabbitmq
	@echo "Rebuilding and starting services..."
	docker-compose --env-file .env.dev -f docker-compose.dev.yml up -d --build postgres rabbitmq backend frontend

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

docker-down: ## Stop all services (default/legacy)
	docker-compose down

docker-logs: ## Show logs from all services (default/legacy)
	docker-compose logs -f

docker-main-down: ## Stop main branch environment
	docker-compose --env-file .env.main -f docker-compose.main.yml down

docker-main-rebuild-safe: ## Gracefully rebuild main backend/frontend while reducing DB crash-recovery risk
	@echo "Gracefully stopping app services first (frontend/backend)..."
	docker-compose --env-file .env.main -f docker-compose.main.yml stop -t 45 frontend backend
	@echo "Stopping stateful services with extended timeout (postgres/rabbitmq)..."
	docker-compose --env-file .env.main -f docker-compose.main.yml stop -t 120 postgres rabbitmq
	@echo "Rebuilding and starting services..."
	docker-compose --env-file .env.main -f docker-compose.main.yml up -d --build postgres rabbitmq backend frontend

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

docker-prod-down: ## Stop production environment
	docker-compose --env-file .env.prod -f docker-compose.prod.yml down

docker-prod-rebuild-safe: ## Gracefully rebuild prod backend/frontend while reducing DB crash-recovery risk
	@echo "Gracefully stopping app services first (frontend/backend)..."
	docker-compose --env-file .env.prod -f docker-compose.prod.yml stop -t 45 frontend backend
	@echo "Stopping stateful services with extended timeout (postgres/rabbitmq)..."
	docker-compose --env-file .env.prod -f docker-compose.prod.yml stop -t 120 postgres rabbitmq
	@echo "Rebuilding and starting services..."
	docker-compose --env-file .env.prod -f docker-compose.prod.yml up -d --build postgres rabbitmq backend frontend

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

docker-uat-down: ## Stop UAT environment
	docker-compose --env-file .env.uat -f docker-compose.uat.yml down

docker-uat-rebuild-safe: ## Gracefully rebuild uat backend/frontend while reducing DB crash-recovery risk
	@echo "Gracefully stopping app services first (frontend/backend)..."
	docker-compose --env-file .env.uat -f docker-compose.uat.yml stop -t 45 frontend backend
	@echo "Stopping stateful services with extended timeout (postgres/rabbitmq)..."
	docker-compose --env-file .env.uat -f docker-compose.uat.yml stop -t 120 postgres rabbitmq
	@echo "Rebuilding and starting services..."
	docker-compose --env-file .env.uat -f docker-compose.uat.yml up -d --build postgres rabbitmq backend frontend

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

docker-up: ## Start all services with Docker Compose (default/legacy)
	docker-compose up -d

docs-check: lint-docs ## Canonical markdown validation gate

docs-check-fix: ## Auto-fix then enforce clean markdown lint
	$(MAKE) lint-docs-fix && $(MAKE) lint-docs

docs-user-build: ## Build the user documentation site (VitePress)
	@echo "Building user documentation site..."
	cd docs-user && npm run docs:build
	@echo "✅ User documentation built in docs-user/.vitepress/dist/"

docs-user-check: docs-user-ci-install docs-user-build ## Canonical local verification gate for docs-user
	@echo "✅ User documentation check complete"

docs-user-ci-install: ## Install user documentation dependencies deterministically (CI-style)
	@echo "Installing user documentation dependencies (npm ci)..."
	cd docs-user && npm ci
	@echo "✅ User documentation dependencies installed (CI mode)"

docs-user-dev: ## Start the user documentation dev server
	@echo "Starting user documentation dev server..."
	cd docs-user && npm run docs:dev

docs-user-install: ## Install user documentation dependencies
	@echo "Installing user documentation dependencies..."
	cd docs-user && npm install
	@echo "✅ User documentation dependencies installed"

fmt: ## Format code
	cd backend && go fmt ./...

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@pwsh -NoProfile -Command "$$targets = Get-Content -LiteralPath 'Makefile'; foreach ($$line in $$targets) { if ($$line -match '^[A-Za-z0-9_.-]+:.*?## ') { $$parts = $$line -split ':.*?## ', 2; if ($$parts.Count -eq 2) { '  {0,-15} {1}' -f $$parts[0], $$parts[1] } } }" || awk -F ':.*## ' '/^[A-Za-z0-9_.-]+:.*## / { printf "  %-15s %s\n", $$1, $$2 }' Makefile

install-hooks: ## Install git hooks for pre-commit validation
	@echo "Installing git hooks..."
	@git config core.hooksPath .githooks
	@chmod +x .githooks/pre-commit
	@chmod +x .githooks/pre-push
	@echo "✅ Git hooks installed. Pre-commit and pre-push validation enabled."
	@echo "   To disable: git config --unset core.hooksPath"

install-tools: ## Install development tools
	go install github.com/swaggo/swag/cmd/swag@latest
	go install github.com/golang-migrate/migrate/v4/cmd/migrate@latest
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	@echo "Installing markdownlint-cli..."
	@if command -v npm > /dev/null 2>&1; then \
		npm install -g markdownlint-cli; \
		npm install -g @finos/calm-cli; \
	else \
		echo "⚠️  npm not found. Install Node.js to get markdownlint-cli and @finos/calm-cli"; \
	fi

lint: ## Run linter
	cd backend && golangci-lint run

lint-all: lint lint-docs ## Run all linters (Go + Markdown)

lint-docs: ## Lint markdown documentation
	@echo "Linting markdown files..."
	@markdownlint --config .markdownlint.yaml "**/*.md" || (echo "❌ markdownlint-cli not installed or failed. Run: make install-tools" && exit 1)

lint-docs-fix: ## Auto-fix markdown linting issues
	@echo "Auto-fixing markdown files..."
	@markdownlint --config .markdownlint.yaml "**/*.md" --fix || (echo "❌ markdownlint-cli not installed or failed. Run: make install-tools" && exit 1)
	@echo "✅ Markdown auto-fix complete"

migrate-create: ## Create a new migration (usage: make migrate-create name=create_users_table)
	migrate create -ext sql -dir backend/migrations -seq $(name)

migrate-dev-down: ## Rollback migrations on development database
	migrate -path backend/migrations -database "postgresql://axiom:axiom_dev_pass@localhost:15432/axiom_dev?sslmode=disable" down

# Environment-specific migrations
migrate-dev-up: ## Run migrations on development database
	migrate -path backend/migrations -database "postgresql://axiom:axiom_dev_pass@localhost:15432/axiom_dev?sslmode=disable" up

migrate-down: ## Rollback database migrations (default/dev)
	migrate -path backend/migrations -database "postgresql://axiom:axiom@localhost:5432/axiom?sslmode=disable" down

migrate-force: ## Force migration version (usage: make migrate-force version=1)
	migrate -path backend/migrations -database "postgresql://axiom:axiom@localhost:5432/axiom?sslmode=disable" force $(version)

migrate-main-down: ## Rollback migrations on main branch database
	migrate -path backend/migrations -database "postgresql://axiom:axiom_main_pass@localhost:45432/axiom_main?sslmode=disable" down

migrate-main-up: ## Run migrations on main branch database
	migrate -path backend/migrations -database "postgresql://axiom:axiom_main_pass@localhost:45432/axiom_main?sslmode=disable" up

migrate-prod-down: ## Rollback migrations on production database
	migrate -path backend/migrations -database "postgresql://axiom:axiom_prod_pass@localhost:35432/axiom_prod?sslmode=disable" down

migrate-prod-up: ## Run migrations on production database
	migrate -path backend/migrations -database "postgresql://axiom:axiom_prod_pass@localhost:35432/axiom_prod?sslmode=disable" up

migrate-uat-down: ## Rollback migrations on UAT database
	migrate -path backend/migrations -database "postgresql://axiom:axiom_uat_pass@localhost:25432/axiom_uat?sslmode=disable" down

migrate-uat-up: ## Run migrations on UAT database
	migrate -path backend/migrations -database "postgresql://axiom:axiom_uat_pass@localhost:25432/axiom_uat?sslmode=disable" up

migrate-up: ## Run database migrations (default/dev)
	migrate -path backend/migrations -database "postgresql://axiom:axiom@localhost:5432/axiom?sslmode=disable" up

pg-upgrade-dev: ## Migrate dev PostgreSQL data to the current major version
	@bash scripts/upgrade-postgres.sh dev

# PostgreSQL major-version upgrade (data migration)
pg-upgrade-main: ## Migrate main branch PostgreSQL data to the current major version
	@bash scripts/upgrade-postgres.sh main

pg-upgrade-prod: ## Migrate production PostgreSQL data to the current major version
	@bash scripts/upgrade-postgres.sh prod

pg-upgrade-uat: ## Migrate UAT PostgreSQL data to the current major version
	@bash scripts/upgrade-postgres.sh uat

run: ## Run the backend application
	cd backend && go run cmd/api/main.go

settings-sort: ## Sort .vscode/settings.json keys alphabetically
	@pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/sort-vscode-settings.ps1

settings-sort-check: ## Check .vscode/settings.json key order (non-zero if unsorted)
	@pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/sort-vscode-settings.ps1 -CheckOnly

smoke-api: ## Run API smoke checks (usage: make smoke-api [env=dev|uat|prod|all] [check_login=1] [startup_wait=90])
	@pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/smoke-api.ps1 -Environment $${env:-all} -StartupWaitSec $${startup_wait:-90} $$( [ "$${check_login:-0}" = "1" ] && echo "-CheckLogin" )

smoke-ssi: ## Run SSI smoke checks (usage: make smoke-ssi [env=dev|uat|prod] [seed=1] [cleanup=1] [timeout=25])
	@pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/smoke-ssi.ps1 -Environment $${env:-dev} -TimeoutSec $${timeout:-25} $$( [ "$${seed:-0}" = "1" ] && echo "-SeedSmokeData" ) $$( [ "$${cleanup:-0}" = "1" ] && echo "-CleanupSmokeData" )

swagger: ## Generate Swagger documentation
	cd backend && swag init -g cmd/api/main.go -o docs

test: ## Run tests
	cd backend && go test -v ./...

test-coverage: ## Run tests with coverage
	cd backend && go test -v -coverprofile=coverage.out ./...
	cd backend && go tool cover -html=coverage.out -o coverage.html

validate-env: ## Validate multi-environment setup
	@bash scripts/validate-multi-env.sh
