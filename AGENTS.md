# AGENTS.md

## Layout

Single git repo, **two independent apps** — there is NO monorepo/workspace wiring. Each has its own
`package.json`, lockfile and `node_modules`. Always run commands from inside the app's directory
(`backend/` or `frontend/`); the root `package.json` has no scripts, so root-level `bun run …` fails.

- `frontend/` — React 19 + Vite 8 app. Entry `src/main.tsx`, all routes in `src/App.tsx`. React Compiler
  via `@rolldown/plugin-babel`, **Tailwind CSS v4**. Brand **Fadarosi**. Order IDs are generated as
  `CLN-YYYYMMDD-NNN` by `orderEntity.generateOrderId` (backend), never hand-written.
- `backend/` — Hono API on Bun, port 3000. Entry `src/index.ts`.
- `design/` and `frontend/design/` — the PNG mockups, the source of truth for page/component structure.
  They are **identical, and both are git-tracked** (33 files each), so a new mockup must land in both or
  in neither. OCR with `tesseract -l ind+eng`. There is still no mockup for the admin report page.

Bun is the package manager and (for the backend) the runtime. `bun`/`bunx` live at `~/.bun/bin` and may
not be on PATH in a fresh shell — use the full path or `export PATH="$HOME/.bun/bin:$PATH"`.

## Verification

There is **no CI** (`.github/` does not exist), so whatever you run locally is the only gate.

Frontend (`frontend/`):

1. `bun run lint` — `eslint .` over `src`, `tests`, `e2e` (only `dist` is ignored). Currently passes
   with 3 pre-existing `react-hooks/exhaustive-deps` **warnings** (map pickers + `AdminSettingsPage`);
   warnings don't fail the gate, don't "fix" them unless you're already editing that file.
2. `bun run build` — `tsc -b && vite build`. `tsc -b` only covers `tsconfig.app.json` (`src`) and
   `tsconfig.node.json` (`vite.config.ts`), so **type errors in `tests/` or `e2e/` do not fail the
   build** — eslint is their only gate.
3. `bun run test` — `bun test tests/unit` (bun test, no jsdom/vitest; 3 files / 35 tests). Tests
   polyfill `localStorage`.
4. `bun run test:e2e` — Playwright (chromium only). See the known-broken notes below.

Backend (`backend/`):

1. `bun run typecheck` — `./node_modules/.bin/tsc --noEmit -p tsconfig.json`. `tsconfig.json` is
   minimal (`strict`, `types: ["bun"]`, `jsx: hono/jsx`) with **no `include`**, so it type-checks
   everything in the app — `tests/` and the committed generated Prisma client included.
2. `bun run test` / `bun run test:unit` — `bun test src/domain/entities src/useCase`. Unit tests live
   next to their source as `*.test.ts` inside `src/`; controllers/middleware have no unit tests. 9
   files / 84 tests, no DB. Output is drowned in structured JSON `logger` lines; that's expected.
3. `bun run test:integration` — `bun test --timeout=30000 tests/integration` against **real Postgres**.
   The `DATABASE_URL` is **hardcoded in the script** (`…/laundry_test`), so an env override will not
   work — to point it elsewhere, run `bun test --timeout=30000 tests/integration` yourself with your
   own `DATABASE_URL`. It needs `prisma db push` on that DB first, and `tests/integration/api.test.ts`
   hits the **real Midtrans sandbox** for `transfer_bank` (hence the timeout). `resetTestDb()` in
   `tests/integration/helpers.ts` wipes every table in FK-safe order and re-seeds one admin + one
   customer, so it destroys that DB's data.

**Known-broken / prerequisite gates — check before blaming your change:**

- `bun run test:integration` currently fails with `P1000 AuthenticationFailed`: the local Postgres 17
  cluster (data dir `/var/lib/postgresql/17/main`) is running on `localhost:5432` but the
  `postgres:postgres` credentials baked into the script don't match it. No password for it is
  available here, so this gate is not runnable without fixing the DB credentials.
- `bun run test:e2e` is currently broken independently of your change: `e2e/helpers.ts` `addPrimaryAddress`
  navigates to `/profil?tab=alamat`, and **no `/profil` route exists** in `src/App.tsx` (both spec
  files call it in `beforeAll`). Fix the helper/route before trusting an e2e failure.
- e2e also needs `bun run build` first (Playwright runs `vite preview`, which serves `dist/`) and
  `bunx playwright install chromium` once. It boots its **own** backend (`:3000`) and preview (`:4173`)
  with `reuseExistingServer: false`, so stop `bun run dev` first or the port bind fails. It waits on
  `GET /health`, passes `CORS_ORIGIN=http://localhost:4173`, and overrides the DB with
  `E2E_DATABASE_URL` (default `…/laundry` — the dev DB, not `laundry_test`).

**Unused imports are build-breaking, not cosmetic**: `tsconfig.app.json` sets `noUnusedLocals` +
`noUnusedParameters`, so a stray import fails `tsc -b` *and* `eslint`.

**`erasableSyntaxOnly: true`** is set for the frontend — no `enum`, no `namespace`, no constructor
parameter properties in `frontend/src`. Use `as const` unions + plain constructors. The backend does
*not* have this restriction and freely uses `constructor(private readonly …)`.

**`allowImportingTsExtensions: true`** is why imports carry explicit extensions; that plus Vite
resolution is what makes the doubled-extension file below importable.

**An eslint error** (not a warning), from `eslint-plugin-react-hooks@7` recommended:
`react-hooks/set-state-in-effect` — calling `setState` synchronously in an effect body. Set it inside
the async callback instead.

**`StrictMode` is on** (`src/main.tsx`), so in dev every effect is mounted → cleaned up → mounted again.
A `useRef` "already ran once" guard therefore *suppresses the second run* and permanently kills whatever
the effect scheduled (e.g. a `setTimeout(() => window.print())` never fires). Arm the timer and let the
cleanup clear it; don't gate on a ref that outlives the simulated remount.

**Local rate limiting will bite during e2e**: `presentation/middleware/rateLimit.ts` keys on
`cf-connecting-ip` → `x-forwarded-for` → `"anonymous"`, and localhost sends neither, so everything
shares the `"anonymous"` bucket. `authRateLimiter` is only **10 requests / 15 min** (`apiRateLimiter`
is 300 / 15 min, both mounted on `/api/*` only). Repeated `bun run test:e2e` runs hit `429` and look
like broken login. The store is in memory: restart the backend to reset it.

## Frontend conventions

- Styling is **Tailwind CSS only** (`@tailwindcss/vite`). Palette is CSS variables under `@theme` in
  `src/index.css` (`--color-primary: #dc2626`, `primary-dark`, `primary-light`, `surface`, `ink`,
  `ink-strong`) — use the token classes (`bg-primary`, `text-ink-strong`, …), not raw hex. Do NOT add
  another CSS framework.
- Libraries already in use: `recharts` (charts), `lucide-react` (icons), `leaflet` + `react-leaflet`
  (maps). Don't add alternatives; match the existing imports.
- Routing via `react-router-dom` in `src/App.tsx` in three blocks: `GuestLayout` (public), then
  `ProtectedRoute` → `CustomerLayout`, then `ProtectedRoute adminOnly` → `AdminLayout`. A new public
  route goes inside the `GuestLayout` block; `/admin/*` inside the `adminOnly` block.
- Layouts in `src/layouts/`, each with its own sidebar; pages in `src/pages/{public,customer,admin}/`;
  shared UI in `src/components/`; contexts in `src/context/` (`AuthContext` → `useAuth`, and
  `OrderDraftContext` for the multi-step checkout draft, both provided in `src/main.tsx`).
- Money/date/status helpers live in `src/lib/`; pages import them as `../../lib/...`.
  - `utils.ts` — `formatRupiah`, `formatNumber`, `formatDateTime`, `formatDateLong`, `timeAgo`,
    `toLocalInputValue`, `fromLocalInputValue`, `orderStatusLabel`, `ORDER_STATUSES`,
    `PAYMENT_METHOD_LABELS`, `PRODUCT_CATEGORIES`, `SORT_OPTIONS`, `cx`. **`combineClass` in the same
    file is dead code with an `any[]` signature — use `cx`.**
  - `format.ts` — `formatIDR` is a thin wrapper over `formatRupiah`, and **`formatIDR` from
    `../../lib/format` is the prevailing import in ~12 pages**. Match that; don't add a third variant.
  - `orderStatus.ts` — `adminStatusLabel` / `adminStatusStyle`, keyed to the backend status strings.
  - `report.ts` — all report period/total logic (see below).
  - Gotcha: the Leaflet default-marker fix lives in `src/lib/leafletIconFix.ts.ts` (**doubled `.ts`**
    extension) and must be imported as `./../lib/leafletIconFix.ts`. Don't "fix" the filename.
  - `src/pages/public/ReceiptPage.tsx` re-declares its own local `formatDateTime`/`formatDateLong`
    instead of using `src/lib/utils.ts`. Existing inconsistency, not a pattern to copy.
- `src/pages/customer/dashboard/` holds sub-components + a local `types.ts` split out of
  `DashboardPage.tsx`; other pages stay single-file.
- API client is a thin `fetch` wrapper in `src/services/apiClient.ts` (exported `API_BASE`, `api`,
  `ApiError`, `tokenStore`) returning the backend envelope `{ success, status, message, data, meta? }`,
  with automatic access-token refresh. Endpoint groups (`adminApi`, `orderApi`, …) live in
  `src/services/api.ts`. `API_BASE` = `VITE_API_URL` ?? `http://localhost:3000/api`.
  Relative `/uploads/...` image paths are proxied to the backend by `vite.config.ts` — but that is
  `server.proxy` only, so it works under `bun run dev` and **not** under `vite preview` (e2e).
- Order status flow used everywhere (as in the mockups):
  `BARU → DITERIMA → DIPROSES → SIAP_ANTAR → SELESAI` (+ `DIBATALKAN`). Backend status strings are used
  verbatim in the frontend status maps — no lowercase alias keys.
- Payment methods: `fadarosipay` (e-wallet), `transfer_bank` (VA), `cod`.
- Copy/UI text is Indonesian; comments in the newer files are Indonesian too. Match the surrounding
  file's language rather than switching.
- Printing is governed by a **global `@media print` block in `src/index.css`**: `body *` gets
  `visibility: hidden`, only `.print-area` (and its children) are made visible, `.print-hidden` gets
  `display: none`, and `@page` is forced to A4 portrait. A page that calls `window.print()` **must** put
  `print-area` on its document root or it prints a blank page. Tailwind `print:` variants alone are
  not enough.
- "Nota" is a printable order receipt: `ReceiptPage` at `/nota/:notaId` (`orderApi.get(notaId)`), the
  reference implementation of the print contract above.

### Report & nota pages

- `AdminReportPage` (`/admin/laporan`) fetches `adminApi.cashflow()` → `GET /api/admin/cash-flow` plus
  `orderApi.list({ perPage: 200 })` and `adminApi.stats()`. That endpoint takes **no date-range
  params**: it returns every `Cash_flow` row wrapped in `CashflowSummary`
  (`{ total_income, total_expense, balance, items }`). All period filtering (preset month window or the
  `Dari`/`Sampai` custom range) and the Pendapatan / Pengeluaran / Saldo Bersih / Jumlah Pesanan
  totals are computed **client-side**. Don't expect server-side date filtering to exist.
- All of that logic lives in **`src/lib/report.ts`** (`resolveReportRange`, `filterByRange`,
  `isWithinRange`, `summarizeCashflow`, `buildMonthlySeries`, `cashflowCategoryLabel`, `monthKey`,
  `formatShortDate`, `toDateInputValue`, `MONTH_SHORT`, plus the `ReportNotaState`/`ReportTotals`
  types). Both report pages import it — add period/total logic there, never duplicate it in a page.
  `cashflowCategoryLabel` lower-cases the category and falls back to the raw string, so unknown
  categories render as-is.
- `ReportNotaPage` in `src/pages/public/ReportReceives.tsx` (route `/laporan/nota`) is the printable
  report document. **"Cetak Laporan" on the report page does not call `window.print()`** — it navigates
  to `/laporan/nota` with the *already-filtered* payload in React Router `location.state`
  (epoch-ms `periodStart`/`periodEnd` + the filtered `cashflow`/`orders`/`lowStock` arrays + `autoPrint`),
  and the nota then calls `window.print()` itself. Opened directly (refresh/bookmark) there is no state,
  so it re-fetches and re-filters from `?mode=&bulan=&dari=&sampai=` (defaults to the current month).
  The route sits in the unauthenticated `GuestLayout` block, but the data path is still admin-only: a
  guest hitting the URL gets "Nota Laporan Tidak Tersedia" because `/api/admin/*` is behind
  `adminMiddleware`.

## Backend

- Dev server: `bun run dev` (`bun run --hot src/index.ts`). `src/index.ts` default-exports the Hono
  `app` and lets Bun serve it — do NOT call `app.listen` in source (tests hit `app.request()`).
- Seed data (admin, customer, outlet, laundry services, products, plus demo orders across every status
  incl. payments/trackings/cashflows): `bun run seed`. Demo orders are skipped if `orders.count() > 0`.
  Seeded logins: `admin@fadarosi.id` / `Admin@1234`, `customer@fadarosi.id` / `User@1234`.
- `config/env.ts` zod-validates `process.env` and **fails fast** — the server refuses to boot without
  `DATABASE_URL`, `JWT_SECRET` (min 16 chars) and the three `MIDTRANS_*` keys. Optional-with-defaults:
  `PORT`, `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`, `CORS_ORIGIN` (default `http://localhost:5173`
  — must point at the frontend origin), `LOG_LEVEL`, `LOG_DIR`, `LOG_RETENTION_DAYS`. See `.env.example`.
  Do not read `process.env` anywhere else.
- Health check `GET /health` actually runs `SELECT 1` and returns 503 when the DB is down — use it as a
  real readiness probe.

### Clean / Onion architecture

Dependencies point inward; `src/domain` and `src/useCase` must not import infrastructure (verified: they
don't). Don't restructure this layering.

```
presentation/  routes, controllers, middleware (auth, adminMiddleware, rateLimit, requestLogging), types.ts
useCase/       application logic (constructed with repositories + entities)
domain/        entities (userEntity, orderEntity, paymentEntity, jwtTokenEntity, …), repository interfaces, types
infrastructure/ prisma client/schema, repository/pg*Repository, seed/, database/migrations
helper/        errorHandling (appError, errorMappings, errorResponse), logging (logger), response (apiResponse: ok/created/noContent)
config/        env.ts
```

- Repositories are injected: controllers and tests construct use cases with an interface from
  `domain/repositories`; route wiring (`presentation/routes/*Route.ts`) instantiates concrete
  `pg*Repository` classes. Shared DI singletons (repos, `tokenIssuer`, `authUseCase`, `authMiddleware`,
  `adminMiddleware`, `handleMidtransNotificationUseCase`) live in `presentation/routes/container.ts` —
  import from there rather than re-instantiating.
- Every module = `domain/{entities|repositories|types}` + `useCase/*` + `presentation/{controller|route}`
  + `infrastructure/repository/pg*`. Use cases do the work and log via `logger` (structured JSON to
  stdout + `LOG_DIR`); they must not import infrastructure.
- Naming: entities are lowercase class names in lowercase files (`orderEntity`), types are lowercase
  (`orderStatus`, `orderDetailType`), repositories are `pgXRepository`. Keep it.
- Security/error conventions in place: JWT access+refresh tokens via `hono/jwt` (NO extra jwt lib),
  tokens persisted in `Access_token`/`Refresh_token` and rotated/revoked on login/refresh/logout,
  `Bun.password.hash` (argon2id) via `userEntity`, zod validation in domain entities, per-route rate
  limiting on `/api/*` only, and a global `app.onError` that maps thrown `AppError` (also Prisma/Zod
  errors) to the JSON envelope via `helper/errorHandling/errorResponse`.
- Controllers are thin: parse → call use case → `ok()`/`created()` from `helper/response`.
- Admin-only endpoints go behind `adminMiddleware` (from `container.ts`); it composes the bearer auth
  middleware and rejects non-`admin` roles with `AppError.forbidden`.
- API routes: `/api/users`, `/api/addresses`, `/api/outlets`, `/api/services`, `/api/products`,
  `/api/orders`, `/api/payments`, `/api/midtrans`, `/api/admin`; health check `/health`. All routers are
  mounted in `src/index.ts` — a new module means touching both its `*Route.ts` and `index.ts`.
- Models in `schema.prisma`: `User`, `Refresh_token`, `Access_token`, `User_address`, `Outlets`,
  `Laundry_services`, `Products`, `Orders`, `Service_order_item`, `Product_order_item`, `Payments`,
  `Order_trackings`, `Cash_flow`. **Do not change the database schema.**

### Business rules that live in specific places (don't re-implement them elsewhere)

- **Status transitions are enforced in the domain entity**, not the use case or controller:
  `orderEntity.assertTransition(current, next)` (`src/domain/entities/orderEntity.ts:49`) allows only
  one forward step along `ORDER_FLOW`, allows `DIBATALKAN` only from `BARU`/`DITERIMA`, and rejects
  anything out of `SELESAI`/`DIBATALKAN` with `AppError.conflict`. The UI's status dropdowns mirror this.
- The status enum lives twice on purpose: `ORDER_FLOW`/`orderStatus` in the backend and
  `adminStatusLabel`/`ORDER_STATUSES` in the frontend — keep them in sync when adding a status.
- **Cash-flow ledger**: `Cash_flow.type` is `income`/`expense`, `category` is a free-form string —
  `"sales"` for income, `"refund"` for the expense written when a PAID order is cancelled or deleted
  (`orderUseCases.ts`). Written from the use cases (create-order payment, Midtrans webhook, SELESAI
  completion, cancel, delete), never from controllers.
- Payment is confirmed (`Payments.status = PAID` + income cash-flow) in three places: `fadarosipay` at
  checkout, the Midtrans webhook, and any pending payment when the order reaches `SELESAI`.

### Midtrans payment gateway

- Payment methods: `fadarosipay` (instant wallet PAID + income cashflow at checkout), `transfer_bank`
  (Midtrans Snap VA token; payment stays PENDING until the webhook confirms it), `cod` (PENDING, paid
  when the order reaches SELESAI). Methods without a VA/bank gateway never call Midtrans.
- Frontend only needs `VITE_PUBLIC_MIDTRANS_CLIENT_KEY` (already in `frontend/.env`). The Snap script is
  injected at checkout time by `CheckoutPage.tsx` from the **hardcoded sandbox URL**
  `https://app.sandbox.midtrans.com/snap/snap.js`; `src/global/payment.global.ts` declares the
  `window.snap` / `SnapResult` ambient types. Swap the URL for production, don't add a second loader.
- Only `transfer_bank` calls Midtrans Snap: `CreateOrderUseCase` builds a token via the injectable
  `midtransSnapClient` interface (last constructor param, default `defaultMidtransSnap()` wrapping the
  real `midtrans-client` Snap; unit tests inject a fake and never hit the network). The Snap `token` is
  stored as `payments.transaction_id`; the create response returns
  `paymentGate { redirect_url, token, order_id }` (NOT full order detail — fetch
  `GET /api/orders/:orderId` for `status`/`payment`).
- Webhook `POST /api/midtrans/notification` (public route, JSON body) verifies the Midtrans signature
  `sha512(order_id + status_code + gross_amount + serverKey)` (hex, compare lowercase), then re-reads the
  authoritative status via `snap.transaction.status(order_id)` (cast through a local `snapWithTransaction`
  type — `@types/midtrans-client` doesn't declare it) and marks the payment PAID + books income
  (`category: "sales"`) idempotently (a second PAID notification is a no-op). Logic lives in
  `src/useCase/payment/midtransNotificationUseCase.ts`.
- `orderDetailType.customer` includes `email` — Midtrans `customer_details` requires it (an empty email
  is rejected with HTTP 400). Keep `email` in the `user` select of `pgOrderRepository` includes.

### Prisma (important quirks)

- Schema: `src/infrastructure/prisma/schema.prisma`, PostgreSQL. Config in `prisma.config.ts` (schema
  path, migrations dir `src/infrastructure/database/migrations`, `datasource.url` from
  `process.env.DATABASE_URL`).
- **Generated client is committed to git** at `src/infrastructure/src/generated/prisma/` (output dir is
  relative to the schema file; `pjtg.ts` comes from `prisma-json-types-generator`). Import it directly,
  e.g. `import { PrismaClient } from "../src/generated/prisma/client"` — do NOT use `@prisma/client`.
- Uses driver adapters: `PrismaPg` from `@prisma/adapter-pg` (see `src/infrastructure/prisma/prisma.ts`).
  The schema `datasource` block has **no `url`**.
- `src/infrastructure/database/migrations/` is gitignored, so it is recreated locally — apply schemas
  with `DATABASE_URL=… ./node_modules/.bin/prisma db push` from `backend/` (do NOT add `--skip-generate`).
- After editing `schema.prisma`, regenerate the committed client with `DATABASE_URL` set:
  `./node_modules/.bin/prisma generate` (needs the `prisma-json-types-generator` binary installed in
  *this* app — the copy in the root `package.json` is not wired up). The committed client is currently in
  sync with the schema, so a stale import error means you skipped the regenerate.

### Dead / misleading files — don't build on them

- `backend/src/infrastructure/config/env.ts` is a leftover stub (`const env = true; export default env;`)
  that nothing imports. The real config is `src/config/env.ts`.
- `frontend/src/lib/utils.ts` `combineClass` is unused (`any[]` signature). Use `cx`.

## Environment / git gotchas

- `.env` files and `*.skills-lock.json` are gitignored at the root (backend has its own `.gitignore` for
  `node_modules/`, `public/uploads`, `logs/`, `.vscode`). Copy `backend/.env.example` to `backend/.env`
  and set `DATABASE_URL` + a long random `JWT_SECRET` + the `MIDTRANS_*` sandbox keys.
- `backend/logs/` (file-based log history) and `backend/public/uploads` (uploaded product images) are
  local-only.
- Postgres 17 is expected on `localhost:5432` (`postgresql://postgres:postgres@localhost:5432/laundry`,
  plus a `laundry_test` DB for integration). See the integration-test note above — those credentials do
  not currently match the running cluster, and the DB can't be fixed from this account.