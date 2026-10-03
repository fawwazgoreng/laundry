# AGENTS.md

## Layout

Single git repo, **two independent apps** — there is NO monorepo/workspace wiring. Each has its own
`package.json`, `bun.lock`, and `node_modules`. Always run commands from inside the app's directory
(`backend/` or `frontend/`); the root `package.json` has no scripts, so root-level `bun run …` fails.

- `frontend/` — React 19 + Vite app (entry `src/main.tsx`, routes in `src/App.tsx`). React Compiler via
  `@rolldown/plugin-babel`, **Tailwind CSS v4**. Brand **Fadarosi**; order IDs look like
  `CLN-YYYYMMDD-NNN`.
- `backend/` — Hono API on Bun, port 3000. Entry `src/index.ts`.
- `design/` (repo root) — PNG UI mockups, the source of truth for page/component structure. This is
  the git-tracked copy; `frontend/design/` is an untracked duplicate — don't add mockups there. OCR
  with `tesseract -l ind+eng`. There is no mockup for the admin report page yet.

Bun is the package manager and (for the backend) the runtime. `bun`/`bunx` live at `~/.bun/bin` and may
not be on PATH in a fresh shell — use the full path or `export PATH="$HOME/.bun/bin:$PATH"`.

## Verification

There is **no CI** (`.github/` does not exist), so whatever you run locally is the only gate.

Frontend (`frontend/`), in this order:

1. `bun run lint` — `eslint .` over `src`, `tests`, `e2e`.
2. `bun run build` — `tsc -b && vite build`.
3. `bun run test` — `bun test tests/unit` (bun test, no jsdom/vitest; tests polyfill `localStorage`).
4. `bun run test:e2e` — Playwright. It starts its **own** backend (`:3000`) and `vite preview` (`:4173`)
   with `reuseExistingServer: false`, so stop `bun run dev` first or the port bind fails. Chromium needs
   `bunx playwright install chromium`. Override the DB with `E2E_DATABASE_URL`.

Backend (`backend/`), in this order:

1. `bun run typecheck` — `./node_modules/.bin/tsc --noEmit -p tsconfig.json`.
2. `bun run test` / `bun run test:unit` — `bun test src/domain/entities src/useCase` (no DB). Output is
   drowned in structured JSON `logger` lines; that's expected.
3. `bun run test:integration` — `bun test --timeout=30000 tests/integration` against **real Postgres**
   (`laundry_test`, URL hardcoded in the script). `tests/integration/helpers.ts` `resetTestDb()` wipes
   every table in FK-safe order and re-seeds one admin + one customer, so it destroys that DB's data.

**Unused imports are build-breaking, not cosmetic**: `tsconfig.app.json` sets `noUnusedLocals` +
`noUnusedParameters`, so a stray import fails `tsc -b` *and* `eslint`. Also an **eslint error** (not a
warning): calling `setState` synchronously in an effect body — set it inside the async callback instead.

**Local rate limiting will bite during e2e**: `presentation/middleware/rateLimit.ts` keys on
`x-forwarded-for`, which localhost requests don't send, so everything shares the `"anonymous"` bucket —
`authRateLimiter` is only **10 requests / 15 min**. Repeated `bun run test:e2e` or Playwright runs hit
`429` and look like broken login. The store is in memory: restart the backend to reset it.

**`StrictMode` is on** (`src/main.tsx`), so in dev every effect is mounted → cleaned up → mounted again.
A `useRef` "already ran once" guard therefore *suppresses the second run* and permanently kills whatever
the effect scheduled (e.g. a `setTimeout(() => window.print())` never fires). Arm the timer and let the
cleanup clear it; don't gate on a ref that outlives the simulated remount.

## Frontend conventions

- Styling is **Tailwind CSS** only (`@tailwindcss/vite`). Palette is CSS variables in `src/index.css`
  (`--color-primary: #dc2626`, `primary-dark`, `primary-light`, `surface`, `ink`, `ink-strong`) — use
  the token classes (`bg-primary`, `text-ink-strong`, …), not raw hex. Do NOT add another CSS framework.
- Libraries already in use: `recharts` (charts), `lucide-react` (icons), `leaflet` + `react-leaflet`
  (maps). Don't add alternatives; match the existing imports.
- Routing via `react-router-dom` in `src/App.tsx`. Layouts in `src/layouts/` (Guest / Customer /
  Admin), each with its own sidebar; pages in `src/pages/{public,customer,admin}/`; shared UI in
  `src/components/`.
- `src/pages/public/` = unauthenticated pages rendered inside `GuestLayout` (landing, auth, nota).
  Adding a route there means adding it inside the `GuestLayout` `<Route element>` block.
- Shared helpers in `src/lib/`: `types.ts` (backend-shaped types), `utils.ts` (`formatRupiah`,
  `formatNumber`, `formatDateLong`, `formatDateTime`, `timeAgo`, `toLocalInputValue`,
  `fromLocalInputValue`, `PRODUCT_CATEGORIES`, `PAYMENT_METHOD_LABELS`, `ORDER_STATUSES`, `cx`),
  `orderStatus.ts` (`adminStatusLabel`/`adminStatusStyle` keyed to backend status strings), `geoCode.ts`,
  `useGeoLocation.ts`. `src/lib/format.ts` only re-exports `formatIDR = formatRupiah` — the two are
  identical, so new code should just import `formatRupiah` from `../../lib/utils`. Pages import these
  as `../../lib/...`.
  - Gotcha: the Leaflet default-marker fix lives in `src/lib/leafletIconFix.ts.ts` (**doubled `.ts`**
    extension). Import it as `./../lib/leafletIconFix.ts`; don't "fix" the filename casually.
  - `src/pages/public/ReceiptPage.tsx` re-declares its own local `formatDateTime`/`formatDateLong`
    instead of using `src/lib/utils.ts`. It's an existing inconsistency, not a pattern to copy.
- `src/pages/customer/dashboard/` holds sub-components + a local `types.ts` split out of
  `DashboardPage.tsx`; other pages stay single-file.
- API client is a thin `fetch` wrapper in `src/services/apiClient.ts` (exported `api`, `ApiError`,
  `tokenStore`) returning the backend envelope `{ success, status, message, data, meta? }`, with
  automatic access-token refresh. Endpoint groups (`adminApi`, `orderApi`, …) live in
  `src/services/api.ts`. `API_BASE` = `VITE_API_URL` ?? `http://localhost:3000/api`; relative
  `/uploads/...` image paths are proxied to the backend by `vite.config.ts`.
- Auth state via `AuthContext` (`useAuth`); role-gate routes with `ProtectedRoute`
  (`adminOnly` prop for the `/admin/*` block). Global toasts come from `ToastProvider`.
- Order status flow used everywhere (as in the mockups):
  `BARU → DITERIMA → DIPROSES → SIAP_ANTAR → SELESAI` (+ `DIBATALKAN`). Backend status strings are
  used verbatim in the frontend status maps — no lowercase alias keys.
- Payment methods: `fadarosipay` (e-wallet), `transfer_bank` (VA), `cod`.
- Copy/UI text is Indonesian; comments in the newer files are Indonesian too. Match the surrounding
  file's language rather than switching.
- Printing is governed by a **global `@media print` block in `src/index.css`**: `body *` gets
  `visibility: hidden`, only `.print-area` (and its children) are made visible, and `.print-hidden` gets
  `display: none`. So a page that calls `window.print()` **must** put `print-area` on its document root or
  it prints a blank page. Tailwind `print:` variants alone are not enough.
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
  `summarizeCashflow`, `buildMonthlySeries`, `cashflowCategoryLabel`, …). Both report pages import it —
  add period/total logic there, never duplicate it in a page.
- `ReportNotaPage` in `src/pages/public/ReportReceives.tsx` (route `/laporan/nota`) is the printable
  report document. **"Cetak Laporan" on the report page does not call `window.print()`** — it navigates
  to `/laporan/nota` with the *already-filtered* payload in React Router `location.state`
  (`ReportNotaState` in `src/lib/report.ts`: epoch-ms `periodStart`/`periodEnd` + the filtered
  `cashflow`/`orders`/`lowStock` arrays + `autoPrint`), and the nota then calls `window.print()` itself.
  Opened directly (refresh/bookmark) there is no state, so it re-fetches and re-filters from
  `?mode=&bulan=&dari=&sampai=` (defaults to the current month). The route sits in the unauthenticated
  `GuestLayout` block, but the data path is still admin-only: a guest hitting the URL gets
  "Nota Laporan Tidak Tersedia" because `/api/admin/*` is behind `adminMiddleware`.

## Backend

- Dev server: `bun run dev` (`bun run --hot src/index.ts`). `src/index.ts` default-exports the Hono
  `app` and lets Bun serve it — do NOT call `app.listen` in source (tests hit `app.request()`).
- Seed data (admin user, outlet, laundry services, products, plus demo orders across every status
  incl. payments/trackings/cashflows): `bun run seed`. Demo orders are skipped if orders already exist.
- `config/env.ts` zod-validates `process.env` and **fails fast** — the server refuses to boot without
  `DATABASE_URL`, `JWT_SECRET`, and the three `MIDTRANS_*` keys. See `.env.example`.
- Health check `GET /health` actually runs `SELECT 1` and returns 503 when the DB is down — use it as
  a real readiness probe when starting the API for e2e.

### Clean / Onion architecture

Dependencies point inward; `domain/` must not import infrastructure:

```
presentation/  routes, controllers, middleware (auth, rateLimit, requestLogging)
useCase/       application logic (constructed with repositories + entities)
domain/        entities (userEntity, jwtTokenEntity), repository interfaces, types
infrastructure/ Prisma client/schema, concrete repositories (pg*Repository), seed/
helper/        errorHandling (AppError, mapToAppError, handleAppError), logging (Logger), response (ok/created)
config/        env.ts
```

- Repositories are injected: controllers and tests construct use cases with an interface from
  `domain/repositories`; route wiring (`presentation/routes/*Route.ts`) instantiates concrete
  `pg*Repository` classes. Shared DI singletons (auth + admin middleware, repos, token issuer, the
  Midtrans notification use case) live in `presentation/routes/container.ts` — import from there
  rather than re-instantiating.
- Every module = `domain/{entities|repositories|types}` + `useCase/*` + `presentation/{controller|route}`
  + `infrastructure/repository`. Use cases do the work and log via `logger` (structured JSON); they must
  not import infrastructure.
- Security/error conventions in place: JWT access+refresh tokens via `hono/jwt` (NO extra jwt lib),
  tokens persisted in the `Access_token`/`Refresh_token` tables and rotated/revoked on
  login/refresh/logout, `Bun.password.hash` (argon2id) for passwords, zod validation in domain
  entities, per-route rate limiting (`hono-rate-limiter` on `/api/*` only), and a global `app.onError`
  that maps thrown `AppError` (also Prisma/Zod errors) to a consistent JSON envelope via
  `helper/errorHandling`.
- Admin-only endpoints go behind `adminMiddleware` (from `container.ts`); it composes the bearer auth
  middleware and rejects non-`admin` roles with `AppError.forbidden`.
- API routes: `/api/users`, `/api/addresses`, `/api/outlets`, `/api/services`, `/api/products`,
  `/api/orders`, `/api/payments`, `/api/midtrans`, `/api/admin`; health check `/health`.
- Models are in `schema.prisma`: `User`, `Refresh_token`, `Access_token`, `User_address`, `Outlets`,
  `Laundry_services`, `Products`, `Orders`, `Service_order_item`, `Product_order_item`, `Payments`,
  `Order_trackings`, `Cash_flow`. **Do not change the database schema.**

### Midtrans payment gateway

- Payment methods: `fadarosipay` (instant wallet PAID + income cashflow at checkout), `transfer_bank`
  (Midtrans Snap VA token; payment stays PENDING until the webhook confirms it), `cod` (PENDING, paid
  when the order reaches SELESAI). Methods without a VA/bank gateway never call Midtrans.
- Frontend only needs `VITE_PUBLIC_MIDTRANS_CLIENT_KEY` (in `frontend/.env`) to open the Snap JS overlay.
- Only `transfer_bank` calls Midtrans Snap: `CreateOrderUseCase` builds a token via `midtransSnapClient`
  (injectable 8th constructor param — unit tests inject a fake and never hit the network;
  `defaultMidtransSnap()` wraps the real `midtrans-client` Snap). The Snap `token` is stored as
  `payments.transaction_id`; the create response returns `paymentGate { redirect_url, token, order_id }`
  (NOT full order detail — fetch `GET /api/orders/:orderId` for `status`/`payment`).
- Webhook `POST /api/midtrans/notification` (public route, JSON body) verifies the Midtrans signature
  `sha512(order_id + status_code + gross_amount + serverKey)` (hex, compare lowercase), then re-reads the
  authoritative status via `snap.transaction.status(order_id)` (cast through a local `snapWithTransaction`
  type — `@types/midtrans-client` does not declare it) and marks the payment PAID + books income
  (`category: "sales"`) idempotently (a second PAID notification is a no-op). Logic lives in
  `src/useCase/payment/midtransNotificationUseCase.ts`.
- `orderDetailType.customer` includes `email` — Midtrans `customer_details` requires it (an empty email
  is rejected with HTTP 400). Keep `email` in the `user` select of `pgOrderRepository` includes.
- Integration tests hit the real Midtrans sandbox for `transfer_bank` orders — hence the
  `--timeout=30000`.

### Prisma (important quirks)

- Schema: `src/infrastructure/prisma/schema.prisma`, PostgreSQL. Config in `prisma.config.ts` (schema
  path, migrations dir `src/infrastructure/database/migrations`, `datasource.url` from
  `process.env.DATABASE_URL`).
- **Generated client is committed to git** at `src/infrastructure/src/generated/prisma/` (output dir
  is relative to the schema file). Import it directly, e.g.
  `import { PrismaClient } from "../src/generated/prisma/client"` — do NOT use `@prisma/client`.
- Uses driver adapters: `PrismaPg` from `@prisma/adapter-pg` (see `src/infrastructure/prisma/prisma.ts`).
  The schema `datasource` block has **no `url`**.
- The `migrations/` directory is gitignored, so it must be recreated/applied locally.
- `prisma generate` needs the `prisma-json-types-generator` binary installed IN THIS APP (it is a
  devDependency here; the copy in the root `package.json` is not wired up). Run with `DATABASE_URL` set:
  `./node_modules/.bin/prisma generate`.
- After editing `schema.prisma`, regenerate the committed client — it can be STALE relative to the
  schema (it originally lacked `Access_token`/`Refresh_token`).

## Environment / git gotchas

- `.env` files and `*.skills-lock.json` are gitignored at the root. Copy `backend/.env.example` to
  `backend/.env` and set `DATABASE_URL` + a long random `JWT_SECRET` + the `MIDTRANS_*` sandbox keys.
- Local PostgreSQL in this environment: a user-owned cluster may be started without sudo via
  `/usr/lib/postgresql/17/bin/pg_ctl -D /tmp/opencode/pgdata -o "-p 5432 -k /tmp/opencode" start`
  (`DATABASE_URL` points to `postgresql://postgres:postgres@localhost:5432/laundry`). Push schemas for
  `laundry` and `laundry_test` with `DATABASE_URL=… ./node_modules/.bin/prisma db push` from `backend/`
  (do NOT add `--skip-generate`).
- `backend/public/uploads` is gitignored — uploaded product images are local-only.
