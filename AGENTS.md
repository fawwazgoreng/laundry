# AGENTS.md

## Layout
- Two independent apps: `frontend/` (React 19 + Vite 8 + Tailwind v4) and `backend/` (Hono + Bun on port 3000). No monorepo workspace - run commands in the app dir.
- Root has no scripts; only dep is `prisma-json-types-generator`. Root `.gitignore` ignores `AGENTS.md`.
- Mockups in `design/` (17 files). `frontend/design/` does not exist.
- Order IDs: `CLN-YYYYMMDD-NNN` via `orderEntity.generateOrderId` (never hand-write).

## Commands

**Frontend (`frontend/`):**
- `bun run dev` / `bun run build` (`tsc -b && vite build`). `tsc -b` checks `tsconfig.app.json` (src) and `tsconfig.node.json` (vite.config.ts) only; tests/e2e not typechecked.
- `bun run lint` - 0 errors, 3 pre-existing `react-hooks/exhaustive-deps` warnings (don't fix unrelated).
- `bun run test` / `bun run test:unit` - `bun test tests/unit` (localStorage polyfilled).
- `bun run test:e2e` - Playwright Chromium. Requires `bun run build` first; starts backend (:3000) + preview (:4173). See Gotchas.

**Backend (`backend/`):**
- `bun run dev` / `bun run prod` - Hono on Bun.
- `bun run typecheck` - `tsc --noEmit -p tsconfig.json` (only `src` + `tests`; generated `migrations/` not checked).
- `bun run test` / `bun run test:unit` - `bun test src/domain/entities src/useCase` (no DB). Logger JSON expected.
- `bun run test:integration` - `bun test --timeout=30000 tests/integration`. Script hardcodes `postgres:postgres@localhost:5432/laundry_test` (override via `DATABASE_URL`). Needs `prisma db update` (Prisma 8; `db push` is not a command) against real Postgres; `resetTestDb()` wipes/reseeds; hits Midtrans sandbox.
- `bun run prisma:generate` - `prisma contract emit` (not `prisma generate`). Schema `src/infrastructure/prisma/contract.prisma`. After schema change run in `backend/`.
- `bun run seed` - seeds DB.

## Architecture
- Clean layered: `domain/` (entities, repo interfaces, types; no infrastructure imports), `useCase/` (app logic, uses logger; no infrastructure imports), `presentation/` (controllers/routes/middleware/types), `infrastructure/` (Prisma client/schema, pg repos, seed).
- DI: `presentation/routes/container.ts` provides singletons. Entities lowercase (`orderEntity`), types lowercase, repos named `pgXRepository`.
- Prisma 8: schema at `backend/src/infrastructure/prisma/contract.prisma` (no datasource `url`). `bun run prisma:generate` runs `prisma contract emit`, writing gitignored `contract.json` + `contract.d.ts` to `src/infrastructure/database/generated/`; rerun after every schema change.
- DB access: use the `prisma` singleton (`infrastructure/prisma/prisma.ts` -> `prisma.orm.public.*`, `prisma.raw.sql`), never `@prisma/client`. The tracked `src/infrastructure/src/generated/prisma/` is a stale pre-Prisma-8 client (predates add-on models); only `errorMappings.ts` uses it for `Prisma.*` error types - don't copy query patterns from it.
- Schema changes: use `prisma db update` (Prisma 8; `db push` does not exist). Migrations are gitignored.
- Order data: list queries include the latest payment and return `payment_status` + `customer_id`; detail queries include the latest `payments` row. Keep these joins when editing order repository queries.
- Add-ons: shared groups/options live in `Service_addon_groups`/`Service_addon_options`; services attach via `Laundry_service_addon_groups`, products via `Product_addon_groups`. `POST /orders` accepts `services[].addons` and `products[].addons` (`group_code`, `option_id`), prices server-side, and snapshots into `Service_order_item_addons`/`Product_order_item_addons`. Add-ons never touch `Products.stock`. Admin CRUD/attachment: `/api/addons/*`.
- Refunds: additive `Refund_requests`; `order_type` is derived (`PRODUCT` only when products exist and services == 0). `/api/refunds` allows product-only, paid, non-COD orders; admin approval calls Midtrans CoreApi `transaction.refund` for `transfer_bank`, flips payment to `REFUNDED`, and books an expense cashflow.
- Deleting orders: use case allows only `SELESAI`/`DIBATALKAN`, for owner or admin. Repository delete unlinks `Cash_flow.order_id`, then deletes refunds/payments/trackings/item add-ons/items/order. Never delete BARU/DITERIMA/DIPROSES/SIAP_ANTAR.

## Frontend Conventions
- Routing: `react-router-dom` v7 - use `<Link>`, `<NavLink>`, `useNavigate`, `<Navigate>`. Never use `window.location` or `addEventListener`. Routes in `App.tsx`. `ProtectedRoute` gates customer vs admin. Admin add-on UI at `/admin/addon`.
- Refund UI: checkout/history show the product-only policy; history/detail show `Product · Refundable` vs `Service · Non-refund`; refund request/decision lives on `OrderDetailPage`.
- Toasts: centralized via `ToastProvider` + `useToast()` (`components/Toast.tsx`; success/error/info, 3.5s auto-dismiss, persists across route changes). `ToastProvider` must wrap `AuthProvider` in `main.tsx` (AuthContext emits toasts).
- API errors: throw `ApiError(message, status, code, details)` (`services/apiClient.ts`). Use `formatFormError(err.details)` (`lib/format.ts`) for field validation. Follow existing CRUD pattern (toast + Button loading).
- Frontend uses `allowImportingTsExtensions: true` - many explicit `.ts`/`.tsx` imports.
- Checkout UI exposes only `transfer_bank` + `cod`; `fadarosipay` exists in `PaymentMethod`, backend, and seed but has no checkout option.

## Deployment (Docker + Nginx)
- `frontend/Dockerfile`: build with bun → `nginx:alpine`; must `COPY nginx.conf /etc/nginx/conf.d/default.conf` (else SPA refresh 404s).
- `frontend/nginx.conf`: `listen 80` (no colon), `try_files $uri $uri/ /index.html`; `index.html` no-cache, `/assets/` immutable. Any static host must fallback to `index.html`.
- `docker-compose.yml`: `db` + `backend` (:3000) + `frontend` (:80 → host 5173) + `ngrok` (fronts `backend:3000`). Root `.env` has Postgres/ngrok; `frontend/.env` has `VITE_PUBLIC_MIDTRANS_CLIENT_KEY` (currently unused - no Snap UI); `backend/.env` must contain Midtrans/JWT vars or the server refuses to boot.
- API base: `VITE_API_URL` else `http://localhost:3000/api` (build-time). Nginx proxies `/uploads/` to `host.docker.internal:3000`; it does not proxy `/api`, so the browser calls the backend cross-origin for remote/ngrok clients.

## Critical Gotchas
- **Integration DB creds**: script hardcodes `postgres:postgres@localhost:5432/laundry_test`. Override with `DATABASE_URL` and ensure it matches your local Postgres. Needs `prisma db update`.
- **E2E broken**: `e2e/helpers.ts` navigates to non-existent `/profil` route (missing from `App.tsx`). E2E needs `bun run build` first; sets `E2E_DATABASE_URL` (defaults to `laundry` dev DB).
- **Frontend build constraints**: `tsconfig.app.json` has `noUnusedLocals` + `noUnusedParameters` (unused imports fail build). `erasableSyntaxOnly: true` (no `enum`, `namespace`, constructor parameter props in src). Use `as const` unions. Backend allows `constructor(private readonly ...)`.
- **React hooks lint**: `react-hooks/set-state-in-effect` is an **error** (not warning). Set state in effect inside async callback or avoid.
- **StrictMode**: effects run mount→cleanup→mount in dev. Don't use "already ran" refs that survive remount (use timeouts/cleared refs).
- **Rate limiting**: key is `cf-connecting-ip` → `x-forwarded-for` → "anonymous"; localhost shares the "anonymous" bucket. `authRateLimiter` 10/15min keyed by IP+path, API 300/15min, mounted only on `/api/*`. Restart backend to reset memory store.
- **Leaflet icon**: import path uses `./../lib/leafletIconFix.ts` (doubled `.ts`) - don't rename.
- **Reports**: `/api/admin/cash-flow` has no date params; filtering/totals computed client-side in `src/lib/report.ts`. Direct access to `/laporan/nota` may re-fetch (navigated with filtered state).
- **Payments**: `transfer_bank` uses Midtrans CoreApi `charge` (bank_transfer/VA, starts PENDING; 24h expiry worker auto-cancels). `fadarosipay`/`cod` rows also start PENDING (with `paid_at` pre-set); only `fadarosipay` books income cashflow at checkout. Admin `/api/payments/confirm` or moving an order to `SELESAI` flips PENDING -> PAID and books cashflow (so fadarosipay gets booked twice on completion). Midtrans webhook verifies signature, ignores non-`transfer_bank`, then re-checks via `snap.transaction.status`.
- **Dead file**: `backend/src/infrastructure/config/env.ts` is a stub - real env is `src/config/env.ts`. `frontend/src/lib/utils.ts` is live (`cx`, formatters, status labels).

## Verification
1. Understand change in relevant layer (grep/read).
2. Run unit tests for affected area (`bun test ...` in frontend or backend).
3. Run typecheck + lint + build as applicable. Don't fix unrelated warnings/errors.
4. Prefer backend unit tests (no DB). Only run integration if DB creds match and you intend to.
5. Never commit unless explicitly asked.