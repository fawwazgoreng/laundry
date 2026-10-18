# AGENTS.md

## Layout
- Two independent apps: `frontend/` (React 19 + Vite 8, Tailwind v4) and `backend/` (Hono + Bun, port 3000). No monorepo workspace - run all commands inside each app.
- Root has no scripts. Root only has `prisma-json-types-generator` as dependency.
- Design mockups: `design/` and `frontend/design/` are identical (33 PNGs) - update both or neither.
- Order IDs: `CLN-YYYYMMDD-NNN` via `orderEntity.generateOrderId` (never hand-written).

## Commands

**Frontend (`frontend/`):**
- `bun run dev` / `bun run build` (`tsc -b && vite build`). `tsc -b` only checks `tsconfig.app.json` (src) and `tsconfig.node.json` (vite.config.ts); tests/e2e are not typechecked.
- `bun run lint` - has pre-existing failures (5 errors + 3 warnings). Don't fix unrelated lint issues.
- `bun run test` / `bun run test:unit` - `bun test tests/unit` (localStorage polyfilled).
- `bun run test:e2e` - Playwright Chromium. Requires `bun run build` first; starts its own backend (:3000) and preview (:4173). See Gotchas.

**Backend (`backend/`):**
- `bun run dev` / `bun run prod` - Hono on Bun.
- `bun run typecheck` - `tsc --noEmit -p tsconfig.json` (no `include` in tsconfig).
- `bun run test` / `bun run test:unit` - `bun test src/domain/entities src/useCase` (9 files/84 tests). Logger outputs JSON (expected).
- `bun run test:integration` - `bun test --timeout=30000 tests/integration`. Hardcoded DB in script targets `laundry_test`; override with `DATABASE_URL`. Requires `prisma db push` against a real Postgres. `resetTestDb()` wipes all tables + reseeds. Hits Midtrans sandbox.
- `bun run prisma:generate` - runs `prisma contract emit` (not `prisma generate`). Schema is `src/infrastructure/prisma/contract.prisma`.
- `bun run seed` - seeds DB.

## Architecture
- Clean layered: `domain/` (entities, repo interfaces, types; no infrastructure imports), `useCase/` (app logic, uses logger; no infrastructure imports), `presentation/` (controllers/routes/middleware/types), `infrastructure/` (Prisma client/schema, pg repos, seed).
- DI: `presentation/routes/container.ts` provides singletons. Entities lowercase (`orderEntity`), types lowercase, repos named `pgXRepository`.
- Prisma: schema at `backend/src/infrastructure/prisma/contract.prisma`. Generated client committed at `backend/src/infrastructure/src/generated/prisma/` - import from there (not `@prisma/client`). Datasource uses adapter-pg (no `url`). Migrations gitignored; use `prisma db push`. After schema change: run `bun run prisma:generate` in `backend/`.

## Frontend Conventions
- Routing: `react-router-dom` v7 - use `<Link>`, `<NavLink>`, `useNavigate`, `<Navigate>`. Never use `window.location` or `addEventListener`. Routes in `App.tsx`. `ProtectedRoute` gates customer vs admin.
- Toasts: centralized via `ToastProvider` + `useToast()` (`components/Toast.tsx`; success/error/info, 3.5s auto-dismiss, persists across route changes). `ToastProvider` must wrap `AuthProvider` in `main.tsx` (AuthContext emits toasts).
- API errors: throw `ApiError(message, status, code, details)` (`services/apiClient.ts`). Use `formatFormError(err.details)` (`lib/format.ts`) for field validation. Follow existing CRUD pattern (toast + Button loading).
- Frontend uses `allowImportingTsExtensions: true` - many explicit `.ts`/`.tsx` imports.

## Deployment (Docker + Nginx)
- `frontend/Dockerfile`: build with bun → `nginx:alpine`; must `COPY nginx.conf /etc/nginx/conf.d/default.conf` (else SPA refresh 404s).
- `frontend/nginx.conf`: `listen 80` (no colon), `try_files $uri $uri/ /index.html`; `index.html` no-cache, `/assets/` immutable. Any static host must fallback to `index.html`.
- `docker-compose.yml`: `db` + `backend` (:3000, internal) + `frontend` (:80 → host 5173) + `ngrok` (fronts `frontend:80`). Root `.env` has Postgres/ngrok; `frontend/.env` has `VITE_PUBLIC_MIDTRANS_CLIENT_KEY`.
- API base: `VITE_API_URL` else `http://localhost:3000/api` (build-time). Nginx does not proxy `/api` or `/uploads`; browser calls backend cross-origin for remote/ngrok clients.

## Critical Gotchas
- **Integration DB creds**: script hardcodes `postgres:postgres@localhost:5432/laundry_test`. Override with `DATABASE_URL` and ensure it matches your local Postgres. Needs `prisma db push`.
- **E2E broken**: `e2e/helpers.ts` navigates to non-existent `/profil` route (missing from `App.tsx`). E2E needs `bun run build` first; sets `E2E_DATABASE_URL` (defaults to `laundry` dev DB).
- **Frontend build constraints**: `tsconfig.app.json` has `noUnusedLocals` + `noUnusedParameters` (unused imports fail build). `erasableSyntaxOnly: true` (no `enum`, `namespace`, constructor parameter props in src). Use `as const` unions. Backend allows `constructor(private readonly ...)`.
- **React hooks lint**: `react-hooks/set-state-in-effect` is an **error** (not warning). Set state in effect inside async callback or avoid.
- **StrictMode**: effects run mount→cleanup→mount in dev. Don't use "already ran" refs that survive remount (use timeouts/cleared refs).
- **Rate limiting**: key is `cf-connecting-ip` → `x-forwarded-for` → "anonymous"; localhost shares the "anonymous" bucket. `authRateLimiter` 10/15min, API 300/15min, mounted only on `/api/*`. Restart backend to reset memory store.
- **Leaflet icon**: import path uses `./../lib/leafletIconFix.ts` (doubled `.ts`) - don't rename.
- **Reports**: `/api/admin/cash-flow` has no date params; filtering/totals computed client-side in `src/lib/report.ts`. Direct access to `/laporan/nota` may re-fetch (navigated with filtered state).
- **Payments**: `transfer_bank` uses Midtrans Snap (creates token). `fadarosipay` marks PAID + income at checkout. `cod` stays PENDING until SELESAI. Webhook verifies signature and re-checks via `snap.transaction.status`.
- **Dead files**: `backend/src/infrastructure/config/env.ts` (stub, unused) - real is `src/config/env.ts`. `frontend/src/lib/utils.ts` has `combineClass` (dead, `any[]`) - use `cx`.
- **Prisma import path**: always import from `backend/src/infrastructure/src/generated/prisma/` (committed client). Schema at `backend/src/infrastructure/prisma/contract.prisma`; generate via `bun run prisma:generate`.

## Verification
1. Understand change in relevant layer (grep/read).
2. Run unit tests for affected area (`bun test ...` in frontend or backend).
3. Run typecheck + lint + build as applicable. Don't fix unrelated warnings/errors.
4. Prefer backend unit tests (no DB). Only run integration if DB creds match and you intend to.
5. Never commit unless explicitly asked.