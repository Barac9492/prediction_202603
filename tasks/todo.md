# SaaS Foundation - Task Tracking

## Phase 1: Schema + Multi-Tenancy
- [x] 1a. Add workspaceId to all 13 core tables in schema.ts
- [x] 1b. Add workspace management tables (workspaces, workspaceMembers)
- [x] 1c. Create workspace.ts helper (getWorkspaceId, getAllWorkspaceIds)
- [x] 1d. Retrofit graph-queries.ts with workspaceId (49 functions)
- [x] 1e. Retrofit queries.ts with workspaceId (6 functions)
- [x] 1f. Retrofit probability.ts with workspaceId (6 functions)
- [x] 1g. Retrofit scoring.ts with workspaceId (5 functions)
- [x] 1h. Retrofit performance.ts with workspaceId (10 functions)
- [x] 1i. Retrofit source-credibility.ts with workspaceId
- [x] 1j. Update all 30 API routes with workspaceId resolution
- [x] 1k. Update 7 intermediate lib files (backtest, recommendations, analysis, actions)
- [x] 1l. Update 10 server component pages
- [x] 1m. Generate drizzle migration (production-safe with backfill)

## Phase 2: Clerk Auth
- [x] 2a. Install @clerk/nextjs
- [x] 2b. Create middleware.ts with route protection + redirect logic
- [x] 2c. Wrap layout in ClerkProvider
- [x] 2d. Create sign-in/sign-up pages
- [x] 2e. Create Clerk webhook route (org.created, membership.created/deleted)
- [x] 2f. Route groups: (marketing), (app), (auth)

## Phase 3: Paddle Billing
- [x] 3a. Install @paddle/paddle-node-sdk
- [x] 3b. Create billing.ts (plan limits, workspace plan management)
- [x] 3c. Create guards.ts (plan enforcement: thesis, seat limits)
- [x] 3d. Create Paddle webhook route
- [x] 3e. Create billing settings page

## Phase 4: Landing Page + Onboarding
- [x] 4a. Marketing landing page with hero, features, pricing
- [x] 4b. Onboarding flow (create org → create thesis → run pipeline)

## Verification
- [x] npx next build passes cleanly
- [ ] Deploy and test end-to-end flow
- [ ] Add env vars: CLERK_*, PADDLE_*, CRON_SECRET

## Review
- Build passes with 0 errors
- 60+ files modified/created across all phases
- Production-safe migration with ws_default backfill
- Paddle chosen over Stripe (merchant of record, handles tax/compliance)
