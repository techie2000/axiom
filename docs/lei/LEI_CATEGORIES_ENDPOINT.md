# LEI Categories Endpoint

**Date:** March 1, 2026  
**Status:** ✅ Active

## Purpose

`GET /api/v1/lei-categories` provides category filter metadata for the LEI records UI.

This endpoint is used to populate the **Category** dropdown in `frontend/app/lei-records/page.tsx` without requiring the client to infer values from paginated LEI result sets.

## Endpoint

- **Method:** `GET`
- **Path:** `/api/v1/lei-categories`
- **Auth:** Public (same access pattern as other LEI list metadata endpoints)

## Response Format

Returns a JSON array of strings.

```json
[
  "BRANCH",
  "FUND",
  "SOLE_PROPRIETOR"
]
```

### Semantics

- Values are distinct, normalized category labels for filtering.
- Empty/blank and null-like values are excluded.
- List ordering is stable for UI consumption.

## Caching Behavior

Category metadata is cached in the LEI service for **24 hours** using `distinctLookupCacheTTL`.

Cache invalidation is triggered after successful LEI processing updates, so newly introduced categories are surfaced without waiting for TTL expiry.

## Query Optimization

The endpoint is backed by repository filtering and optimization work, including migration `000036_optimize_distinct_category_metadata`.

The optimization targets fast retrieval of distinct category values while excluding blank and null-like rows.

## Related Files

- `backend/internal/handler/lei_handler.go` (`GetDistinctCategories`)
- `backend/internal/service/lei_service.go` (`GetDistinctCategories`, cache behavior)
- `backend/internal/repository/lei_repository.go` (`GetDistinctCategories` query)
- `frontend/app/lei-records/page.tsx` (category dropdown metadata fetch)

## Tests

Coverage for this endpoint flow exists across:

- Service caching behavior: `backend/internal/service/lei_service_test.go`
- Repository query behavior: `backend/internal/repository/lei_repository_filter_test.go`
- Handler success/error behavior: `backend/internal/handler/lei_handler_test.go`
