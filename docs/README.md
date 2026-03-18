# Axiom Documentation

Welcome to the Axiom project documentation. This directory contains comprehensive documentation
for the Financial Services Static Data Management System.

## 📚 Documentation Structure

### 🏗️ Architecture

- [**Architecture Overview**](./architecture.md) - High-level system design and technology stack

### 📋 Architectural Decision Records (ADR)

Located in [adr/](./adr/):

- [ADR-0001: Modular Monolith Architecture](./adr/adr-0001-modular-monolith-architecture.md)
- [ADR-0002: Go + Gin Backend](./adr/adr-0002-go-gin-backend.md)
- [ADR-0003: PostgreSQL + GORM](./adr/adr-0003-postgres-gorm.md)
- [ADR-0004: JWT Authentication](./adr/adr-0004-jwt-authentication.md)
- [ADR-0005: RabbitMQ Async Processing](./adr/adr-0005-rabbitmq-async-processing.md)
- [ADR-0006: Next.js + Tailwind Frontend](./adr/adr-0006-nextjs-tailwind-frontend.md)
- [ADR-0007: Docker Compose Local Development](./adr/adr-0007-docker-compose-local-dev.md)
- [ADR-0008: Sticky Headers with Smooth Transitions](./adr/adr-0008-sticky-headers-with-smooth-transitions.md)
- [ADR-0009: Git Branching Strategy](./adr/adr-0009-git-branching-strategy.md)

### 🤝 Contributing

Located in [contributing/](./contributing/):

- [**Branching Strategy**](./contributing/BRANCHING_STRATEGY.md) - Branch naming, promotion workflow,
  protection rules, and hotfix procedure

### 🎨 Frontend Patterns

- [**UI Patterns Guide**](./ui-patterns.md) - Reusable frontend patterns and component templates ⭐ **For UI development**

### 👤 User Documentation

- [**User Docs Home**](../docs-user/README.md) - Dedicated end-user documentation space for workflow-driven app usage
  guidance
- [**Published User Docs Site**](https://techie2000.github.io/axiom/docs-user/) - Publicly hosted docs experience

### 🖼️ Branding Assets

Located in [assets/branding/](./assets/branding/):

- [**Branding Assets README**](./assets/branding/README.md) - Source logo files and generated favicon/logo outputs

### 💳 SSI (Standard Settlement Instructions)

Located in [ssi/](./ssi/):

- [**SSI UI Schema (MVP)**](./ssi/SSI_UI_SCHEMA.md) - Initial table columns, filters, and virtual flag guidance

### 🌍 Environment Configuration

Located in [environments/](./environments/):

- [**Environment Port Reference**](./environments/environment-port-reference.md) - Port assignments for all environments
- [**Multi-Environment Setup**](./environments/multi-environment-setup.md) - Detailed setup guide for dev/uat/prod
- [**Multi-Environment Quickstart**](./environments/multi-environment-quickstart.md) - Quick setup commands
- [**README**](./environments/README.md) - Environment documentation index

### 🔍 LEI (Legal Entity Identifier) Feature

Located in [lei/](./lei/):

#### Getting Started

- [**LEI Quickstart**](./lei/LEI_QUICKSTART.md) - Quick setup and testing guide ⭐ **Start here**
- [**LEI Implementation Summary**](./lei/LEI_IMPLEMENTATION_SUMMARY.md) - Complete feature overview

#### Technical Documentation

- [**LEI Data Flow**](./lei/LEI_DATA_FLOW.md) - End-to-end data acquisition and processing flow
- [**LEI Acquisition**](./lei/LEI_ACQUISITION.md) - GLEIF API integration details
- [**LEI Countries Refactor**](./lei/LEI_COUNTRIES_REFACTOR.md) - Country data handling improvements

#### API Migration Notice

- Import processing failures endpoint migration:
  - Preferred: `GET /api/v1/lei/import-failures`
  - Deprecated (temporary): `GET /api/v1/lei/level2/failures`
- The deprecated endpoint returns deprecation metadata headers
  (`Deprecation`, `Sunset`, `Link`, `Warning`) to support client migration.
- Planned removal target: `v0.5` (tracked by GitHub issue `#87`).

#### Issue Resolution

- [**LEI Persistence and Race Condition Fix**](./lei/LEI_PERSISTENCE_AND_RACE_CONDITION_FIX.md) - Duplicate processing fix
- [**LEI Processing Fixes**](./lei/LEI_PROCESSING_FIXES.md) - Processing reliability improvements
- [**Delta URL Fix Summary**](./lei/DELTA_URL_FIX_SUMMARY.md) - GLEIF delta endpoint update

### ⚡ Performance Optimization

Located in [performance/](./performance/):

#### Analysis & Results

- [**LEI Search Performance Analysis**](./performance/LEI_SEARCH_PERFORMANCE_ANALYSIS.md) - Performance journey
  (3 phases)
- [**Performance Verification Results**](./performance/PERFORMANCE_VERIFICATION_RESULTS.md) - Test results and
  metrics

#### Implementation Guides

- [**Dynamic SELECT Implementation**](./performance/DYNAMIC_SELECT_IMPLEMENTATION.md)
  - Phase 2: Column selection (5-6x improvement)
- [**Hybrid Sorting Implementation**](./performance/HYBRID_SORTING_IMPLEMENTATION.md)
  - Phase 3: Smart sorting strategy (44x improvement)

---

## 🚀 Quick Navigation

### For Developers

1. **New to the project?** → [Architecture Overview](./architecture.md)
2. **Setting up environments?** → [Multi-Environment Quickstart](./environments/multi-environment-quickstart.md)
3. **Working on LEI feature?** → [LEI Quickstart](./lei/LEI_QUICKSTART.md)
4. **Building UI components?** → [UI Patterns Guide](./ui-patterns.md) ⭐ **New!**
5. **Performance tuning?** → [LEI Search Performance Analysis](./performance/LEI_SEARCH_PERFORMANCE_ANALYSIS.md)

### For End Users

1. **How do I use the app?** → [User Docs Home](../docs-user/README.md)
2. **Live published site** → [https://techie2000.github.io/axiom/docs-user/](https://techie2000.github.io/axiom/docs-user/)

### For System Administrators

1. **Deploy multi-environment setup** → [Multi-Environment Setup](./environments/multi-environment-setup.md)
2. **Port reference** → [Environment Port Reference](./environments/environment-port-reference.md)

### For Architects

1. **System design** → [Architecture Overview](./architecture.md)
2. **Architectural decisions** → [ADR Directory](./adr/)
3. **Performance strategy** → [Performance Analysis](./performance/LEI_SEARCH_PERFORMANCE_ANALYSIS.md)

### For Contributors

1. **Branching and promotion workflow** → [Branching Strategy](./contributing/BRANCHING_STRATEGY.md)
2. **Branch setup script** → [scripts/setup-branches.sh](../scripts/setup-branches.sh)

---

## 📊 Project Status

### LEI Feature

✅ **Production Ready**

- Full data acquisition (3.2M+ records)
- Daily full sync at 2 AM (delta disabled for reliability)
- Search performance < 60ms
- 99.9% uptime target

### Performance Metrics

- **Phase 1** (Database indexes): 60% improvement
- **Phase 2** (Dynamic SELECT): 5-6x improvement (489ms → 80-97ms)
- **Phase 3** (Hybrid sorting): 44x improvement (1276ms → 28.9ms)
- **All queries**: < 60ms (70% faster than 200ms target)

---

## 🤝 Contributing

When adding new documentation:

1. Place feature docs in appropriate subdirectories (lei/, performance/, etc.)
2. Update this README.md index
3. Use relative links for cross-references
4. Follow existing naming conventions (UPPERCASE_WITH_UNDERSCORES.md)
5. Follow the [Branching Strategy](./contributing/BRANCHING_STRATEGY.md) for branch naming and
   promotion

---

## 📝 Documentation Conventions

- **README.md** - Directory index (this file)
- **FEATURE_NAME.md** - Feature documentation
- **FEATURE_NAME_ISSUE_FIX.md** - Specific issue resolution
- **ADR-NNNN-title.md** - Architectural Decision Record

---

## Last Updated

March 15, 2026
