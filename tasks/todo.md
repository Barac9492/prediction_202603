# Fix 9 Critical Issues for Paying Users

## Phase 1: Schema + Migration (Issues 7, 9)
- [x] Add trialExpiresAt to workspaces table
- [x] Add uniqueIndex on entities(workspaceId, name)
- [x] Generate drizzle migration (0003_hot_king_cobra.sql)

## Phase 2: Middleware (Issue 4)
- [x] Add /api/cron and /api/pipeline/run to public routes

## Phase 3: Extract Core Logic (Issue 5)
- [x] Create feed-fetch.ts, feed-ingest.ts, markets-fetch.ts, vault-ingest.ts
- [x] Slim down 4 route files to thin wrappers
- [x] Update cron route to use direct function calls
- [x] Update pipeline/run route to use direct imports

## Phase 4: Billing APIs (Issue 1)
- [x] Create /api/billing/current route
- [x] Create /api/billing/checkout route

## Phase 5: Guard Enforcement (Issue 3)
- [x] Add guard calls to POST /api/theses

## Phase 6: Trial Expiry (Issue 7 continued)
- [x] Update requireActivePlan() with trialExpiresAt check
- [x] Set trialExpiresAt in clerk webhook org.created handler

## Phase 7: Paddle Webhook Security (Issue 6)
- [x] Add HMAC-SHA256 signature verification

## Phase 8: Onboarding Bug (Issue 8)
- [x] Wrap step transition in useEffect

## Phase 9: Nav User Controls (Issue 2)
- [x] Add UserButton, OrganizationSwitcher, Settings link

## Verification
- [x] npx next build passes (0 errors, all 19 static + dynamic routes)
