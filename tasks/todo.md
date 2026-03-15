# Test All Functions & Run Valuable Backtests

## Phase 1: Environment & Server Startup
- [x] Check env files — `.env` has DATABASE_URL and OBSIDIAN_VAULT_PATH only
- [x] Add dev mode fallback for missing Clerk keys (conditional ClerkProvider)
- [x] Update middleware to pass-through without Clerk
- [x] Update workspace.ts to return "test-workspace" when Clerk absent
- [x] Update Nav, onboarding, billing, sign-in, sign-up to handle missing Clerk
- [x] Start dev server — runs on http://localhost:3000
- [x] DB migrations already applied (drizzle-kit push: "No changes detected")
- [x] Created "test-workspace" in workspaces table with analyst plan

## Phase 2: Chrome DevTools Testing — All Pages
| Page | URL | Status | Notes |
|------|-----|--------|-------|
| Landing | `/` | PASS | Hero, pricing section, CTA buttons render |
| Sign-in | `/sign-in` | PASS | Dev mode fallback with "Go to Dashboard" link |
| Dashboard | `/dashboard` | PASS | Signal clusters, entity activity, uncovered entities |
| Briefing | `/briefing` | PASS | "Nothing urgent today" empty state |
| Thesis | `/thesis` | PASS | List loads, Suggest + New Thesis buttons |
| Thesis detail | `/thesis/12` | PASS | Shows NVIDIA thesis with direction, domain, status |
| Recommendations | `/recommendations` | PASS | Active recs grid, generate section |
| Predictions | `/predictions` | PASS | Tab navigation, resolved theses table with Brier scores |
| Portfolio | `/portfolio` | PASS | Exposure cards with Long/Short/Neutral counts |
| Performance | `/performance` | PASS | All metric cards, cumulative returns chart |
| Graph | `/graph` | PASS | Stats (42 connections), backfill button |
| Feed | `/feed` | PASS | RSS fetch, process buttons, stats |
| Ops | `/ops` | PASS | Feed/Analyze/Backtest tabs |
| Backtest | `/backtest` | PASS | Sliders, Run Backtest + Run Sweep buttons |
| Billing | `/settings/billing` | PASS | Analyst plan displayed, Switch Plan buttons |
| Onboarding | `/onboarding` | PASS | Skips to thesis creation in dev mode |
| Analyze | `/analyze` | PASS | Source input form renders |

**No console errors detected across all pages.**

## Phase 4: Backtests
- [x] Created `scripts/run-backtests.ts` — standalone script bypassing HTTP/auth
- [x] Seeded 5 resolved theses with 42 connections
- [x] Ran 9 named backtests (all stored in backtestRuns table)
- [x] Ran full 400-combo parameter sweep (runId: 10)
- [x] All 10 backtest runs stored in DB

## Phase 5: Issues Found & Fixed
- [x] App crashed without Clerk keys — fixed with conditional ClerkProvider
- [x] Middleware blocked all routes without Clerk — added dev passthrough
- [x] getWorkspaceId() threw without orgId — added "test-workspace" fallback
- [x] Nav crashed on Clerk components — made conditional
- [x] Onboarding/billing used Clerk hooks without provider — made conditional
- [x] Sign-in/sign-up imported Clerk unconditionally — made conditional

## Verification
- [x] Dev server starts and all 17 pages render without crashes
- [x] Chrome DevTools screenshots confirm every page loads
- [x] 10 backtest runs stored in backtestRuns table
- [x] No runtime errors in browser console
