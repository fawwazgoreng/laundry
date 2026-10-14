# AGENTS.md

## Layout
- Two independent apps: `frontend/` (React 19 + Vite 8, Tailwind v4) and `backend/` (Hono + Bun, port 3000). No monorepo workspace - run commands inside each app.
- Root has no scripts. Bun is runtime/PM (`~/.bun/bin` may not be on PATH).
- Design mockups (`design/`, `frontend/design/`) are identical (33 PNGs each) - update both or neither.
- Order IDs: `CLN-YYYYMMDD-NNN` via `orderEntity.generateOrderId` (never hand-written).

## Commands
**Frontend (`frontend/`):**
- `bun run lint` - passes; 3 pre-existing `react-hooks/exhaustive-deps` warnings don't fail (ignore unless editing those files).
- `bun run build` - `tsc -b && vite build`. `tsc -b` only checks `tsconfig.app.json` (src) + `tsconfig.node.json` (vite.config.ts); tests/e2e not typechecked by build.
- `bun run test` - `bun test tests/unit` (localStorage polyfilled).
- `bun run test:e2e` - Playwright chromium (needs built dist, own backend+preview). Broken currently: helper navigates to non-existent `/profil` route. See gotchas.

**Backend (`backend/`):**
- `bun run typecheck` - tsc --noEmit over entire app (no `include`).
- `bun run test` / `bun run test:unit` - `bun test src/domain/entities src/useCase` (9 files/84 tests). Logger JSON output is expected.
- `bun run test:integration` - `bun test --timeout=30000 tests/integration` against real Postgres. DB URL is **hardcoded** in script (`…/laundry_test`) - override by running with your own `DATABASE_URL`. Needs `prisma db push`. Hits Midtrans sandbox (transfer_bank). `resetTestDb()` wipes all tables + reseeds.

## Architecture (layers)
- `domain/` (entities, repo interfaces, types) - no infrastructure imports.
- `useCase/` - application logic; uses logger (structured JSON); no infrastructure imports.
- `presentation/` - controllers, routes, middleware (auth, admin, rateLimit, requestLogging), types.
- `infrastructure/` - Prisma client/schema, pg* repositories, seed, migrations.
DI: `presentation/routes/container.ts` provides singletons. Every module follows: domain + useCase + presentation (controller/route) + infrastructure/repo. Entities lowercase (`orderEntity`), types lowercase, repos `pgXRepository`.

## Critical Gotchas
- **Integration DB creds**: script uses `postgres:postgres@localhost:5432` but local cluster credentials differ - currently not runnable.
- **E2E broken**: `e2e/helpers.ts` expects `/profil` route (missing from `App.tsx`). E2E needs `bun run build` first; runs own backend (:3000), preview (:4173), sets `E2E_DATABASE_URL` (defaults to `laundry` dev DB).
- **Frontend build-breaking**: `tsconfig.app.json` has `noUnusedLocals` + `noUnusedParameters` - unused imports fail tsc+b and eslint. `erasableSyntaxOnly: true` (no `enum`, `namespace`, constructor parameter props in src). Use `as const` unions. Backend allows `constructor(private readonly ...)`.
- **React hooks lint**: `react-hooks/set-state-in-effect` is an error (not warning) - setState in effect must go inside async callback.
- **StrictMode**: effects run mount→cleanup→mount in dev; don't use "already ran" ref that survives remount (use timeouts/cleared refs).
- **Rate limiting**: `cf-connecting-ip` → `x-forwarded-for` → "anonymous"; localhost shares "anonymous" bucket. `authRateLimiter` is 10/15min (api 300/15min, mounted only on `/api/*`). Restart backend to reset memory store.
- **Leaflet icon**: imported as `./../lib/leafletIconFix.ts` (doubled `.ts` in filename). Don't rename.
- **Report pages**: `/api/admin/cash-flow` has no date params - all filtering/totals computed client-side in `src/lib/report.ts`. Report nota navigates to `/laporan/nota` with filtered state from `/admin/laporan`; direct access re-fetches.
- **Payment flow**: `transfer_bank` uses Midtrans Snap (creates token). `fadarosipay` marks PAID + income at checkout. `cod` PENDING until SELESAI. Webhook verifies signature, re-checks via `snap.transaction.status`.
- **Prisma**: generated client committed at `src/infrastructure/src/generated/prisma/`. Import from there (not `@prisma/client`). Schema has no `url` in datasource (adapter-pg). Migrations gitignored - use `prisma db push`. After schema change: `prisma generate` in backend/.
- **Dead files**: `backend/src/infrastructure/config/env.ts` stub (unused); real is `src/config/env.ts`. `frontend/src/lib/utils.ts` has `combineClass` (dead, `any[]`) - use `cx`.
- **Exports/imports**: frontend uses `allowImportingTsExtensions: true` - many explicit `.ts`/`.tsx` imports.

## Verification order
1. Understand change via grep/read in relevant layer.
2. Run unit tests for affected area (`bun test ...` in backend or frontend).
3. Run typecheck + lint + build as applicable. Don't fix unrelated warnings.
4. For backend, prefer unit tests (no DB). Integration needs setup; don't run if DB creds don't match.
5. Never commit unless explicitly asked.
