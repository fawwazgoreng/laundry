# AGENTS.md

## Layout

Single git repo, **two independent apps** — there is NO monorepo/workspace wiring. Each has its own
`package.json`, `bun.lock`, and `node_modules`. Always run commands from inside the app's directory
(`backend/` or `frontend/`), never from the repo root.

- `frontend/` — React 19 + Vite app (entry `src/main.tsx`). React Compiler via `@rolldown/plugin-babel`,
  **Tailwind CSS** with a crimson palette. `design/` holds the PNG UI mockups that are the source of
  truth for page/component structure; OCR the PNGs with `tesseract -l ind+eng` when you need their text.
- `backend/` — Hono API on Bun. Entry `src/index.ts`, listens on port 3000.

Bun is the package manager and (for the backend) the runtime. Frontend lockfiles are also `bun.lock`
even though its scripts look npm-ish.

## Frontend conventions

- Styling is **Tailwind CSS** (@tailwindcss/vite plugin), palette tokens (crimson `#DC2626` primary,
  `#f3f4f6` surface, `#374151` text, `#111827` dark text). Do NOT add other CSS frameworks.
- Routing via `react-router-dom`. Layouts in `src/layouts/` (Guest / Customer / Admin), each with its own
  sidebar; pages in `src/pages/{public,customer,admin}/`; shared UI in `src/components/`.
- Pages are wired to the backend API, not static mocks: customer `DashboardPage`, `LaundryWizardPage`
  (`/layanan`), `ShopPage` (`/toko`), `CheckoutPage`, `OrderDetailPage` (`/riwayat/:orderId`),
  `OrderTrackingPage` (`/tracking/:orderId`), `PaymentPage` (`/payment/:orderId`); admin
  `AdminDashboardPage` (`/admin`), `AdminOrderManagementPage` (`/admin/pesanan`),
  `AdminServiceManagementPage` (`/admin/layanan`), `AdminProductManagementPage` (`/admin/produk`),
  `AdminReportPage` (`/admin/laporan`), `AdminSettingsPage` (`/admin/pengaturan`).
  `AdminReportPage` filters cashflow/orders client-side over a preset month range OR a custom
  date range (`Dari`/`Sampai` inputs) and has a `window.print()` "Cetak Laporan" action — the
  `Topbar` carries `print:hidden` so prints only show the report body + a print-only header.
- Shared helpers live in `src/lib/`: `types.ts` (backend-shaped types), `utils.ts`
  (`formatRupiah`, `formatDateLong`, `PRODUCT_CATEGORIES`, `cx`), `format.ts` (`formatIDR` alias),
  `orderStatus.ts` (`adminStatusLabel`/`adminStatusStyle` keyed to backend status strings). Pages in
  `src/pages/customer|admin/` import these as `../../lib/...`.
- API client is a thin `fetch` wrapper in `src/services/` returning the backend envelope
  `{ success, status, message, data, meta? }`, with automatic access-token refresh. Auth state via
  `AuthContext` (`useAuth`); role-gate routes with the `ProtectedRoute` component.
- Order status flow used everywhere (as in the mockups):
  `BARU → DITERIMA → DIPROSES → SIAP_ANTAR → SELESAI` (+ `DIBATALKAN`). Backend status strings are
  used verbatim in the frontend status maps (no lowercase alias keys).
- Brand: **Fadarosi**. Order IDs look like `CLN-YYYYMMDD-NNN`. Payment methods:
  `fadarosipay`, `transfer_bank` (VA), `cod`.

## Backend

- Dev server: `bun run dev` (runs `bun run --hot src/index.ts`). `src/index.ts` exports the Hono
  `app` and lets Bun serve it — do NOT call `app.listen` in source (tests hit `app.request()`)
  and there is no auto-listen in library imports.
- Verification:
  - Typecheck: `bun run typecheck` (i.e. `./node_modules/.bin/tsc --noEmit -p tsconfig.json`).
  - Unit tests (entities + use cases, no DB): `bun run test` / `bun run test:unit`.
  - Integration tests (real Postgres, Hono `app.request()` against `laundry_test`):
    `bun run test:integration` — requires the local Postgres cluster + `laundry_test` schema pushed.
- `bun`/`bunx` live at `~/.bun/bin` and may not be on PATH in a shell — use the full path or
  `export PATH="$HOME/.bun/bin:$PATH"`.
- Frontend: `bun run build` (`tsc -b && vite build`), `bun run lint`, unit tests `bun run test`
  (`tests/unit`, bun test — no jsdom/vitest, polyfill localStorage in tests), and Playwright e2e
  `bun run test:e2e` (browsers via `bunx playwright install chromium`). `tests/unit` and `e2e/` are
  OUTSIDE `tsconfig.app.json` include, so `tsc -b` ignores them, but eslint lints them.

### Midtrans payment gateway

- Payment methods: `fadarosipay` (instant wallet PAID + income cashflow at checkout), `transfer_bank`
  (Midtrans Snap VA token; payment stays PENDING until the webhook confirms it), `cod` (PENDING, paid
  when the order reaches SELESAI). Payment methods without a VA/bank gateway (fadarosipay, cod) never
  call Midtrans.
- Required env (env.ts fails fast if missing): `MIDTRANS_MERCHANT_ID`, `MIDTRANS_SERVER_KEY`,
  `MIDTRANS_CLIENT_KEY` (sandbox values in `backend/.env`; frontend only needs
  `VITE_PUBLIC_MIDTRANS_CLIENT_KEY` to open the Snap JS overlay). See `backend/.env.example`.
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
  `src/useCase/payment/midtransNotificationUseCase.ts`; wired as `handleMidtransNotificationUseCase`
  singleton in `presentation/routes/container.ts`.
- `orderDetailType.customer` includes `email` — Midtrans `customer_details` requires it (an empty email
  is rejected with HTTP 400). Keep `email` in the `user` select of `pgOrderRepository` includes.
- Integration tests hit the real Midtrans sandbox for transfer_bank orders, so `bun run test:integration`
  runs with `--timeout=30000` (Bun's 5s default is shorter than the sandbox round-trip).

### Clean / Onion architecture

Dependencies point inward; `domain/` must not import infrastructure:

```
presentation/  routes, controllers, middleware (auth, rateLimit, requestLogging)
useCase/       application logic (constructed with repositories + entities)
domain/        entities (userEntity, jwtTokenEntity), repository interfaces, types
infrastructure/ Prisma client/schema, concrete repositories (pgUserRepository, pgTokenRepository)
helper/        errorHandling (AppError, mapToAppError, handleAppError), logging (Logger), response (ok/created)
config/        env.ts — zod-validates process.env (DATABASE_URL, JWT_SECRET, ...)
```

- Repositories are injected: controllers/what tests construct use cases with an interface from
  `domain/repositories`; route wiring (`presentation/routes/*Route.ts`) instantiates concrete
  `pg*Repository` classes. Shared DI singletons (auth middleware, admin middleware, repos, token
  issuer) live in `presentation/routes/container.ts` — import from there rather than re-instantiating.
- Every module = `domain/{entities|repositories|types}` + `useCase/*` + `presentation/{controller|route}`
  + `infrastructure/repository`. Use cases do the work and log via `logger` (structured JSON); they must
  not import infrastructure.
- Security/error conventions in place: JWT access+refresh tokens via `hono/jwt` (NO extra jwt lib),
  tokens persisted in the `Access_token`/`Refresh_token` tables and rotated/revoked on
  login/refresh/logout, `Bun.password.hash` (argon2id) for passwords, zod validation in domain
  entities, per-route rate limiting, and a global `app.onError` that maps thrown `AppError`
  (also Prisma/Zod errors) to a consistent JSON envelope via `helper/errorHandling`.
- Admin-only endpoints go behind `adminMiddleware` (from `container.ts`). It composes the bearer
  auth middleware and rejects non-`admin` roles with `AppError.forbidden`.
- API routes: `/api/users`, `/api/addresses`, `/api/outlets`, `/api/services`,
  `/api/products`, `/api/orders`, `/api/payments`, `/api/midtrans`, `/api/admin`; health check `/health`.
  Frontend `API_BASE` = `VITE_API_URL` ?? `http://localhost:3000/api`.

### Prisma (important quirks)

- Dont change now database schema 
- Schema: `src/infrastructure/prisma/schema.prisma`. Database is PostgreSQL.
- **Generated client is committed to git** at `src/infrastructure/src/generated/prisma/` (output dir
  is relative to the schema file). Import it directly, e.g.
  `import { PrismaClient } from "../src/generated/prisma/client"` — do NOT use `@prisma/client`.
- Uses driver adapters: `PrismaPg` from `@prisma/adapter-pg` (see `src/infrastructure/prisma/prisma.ts`).
  The schema `datasource` block has **no `url`**; the connection string comes from `prisma.config.ts`,
  which reads `process.env.DATABASE_URL`.
- Config lives in `prisma.config.ts` (schema path, migrations dir `src/infrastructure/database/migrations`).
- The `migrations/` directory is gitignored, so it must be recreated/applied locally.
- `prisma generate` needs the `prisma-json-types-generator` binary installed IN THIS APP
  (it is a devDependency here; the copy in the root `package.json` is not wired up). Run with
  `DATABASE_URL` set: `./node_modules/.bin/prisma generate`.
- After editing `schema.prisma`, regenerate the committed client — the committed client can be
  STALE relative to the schema (e.g. it originally lacked `Access_token`/`Refresh_token`).

## Environment / git gotchas

- `.env` files and `*.skills-lock.json` are gitignored at the root. Copy `backend/.env.example` to
  `backend/.env` and set `DATABASE_URL` + a long random `JWT_SECRET` + the `MIDTRANS_*` sandbox keys
  (env.ts fails fast on missing values — the server refuses to boot without them).
- Local PostgreSQL in this environment: a user-owned cluster may be started without sudo via
  `/usr/lib/postgresql/17/bin/pg_ctl -D /tmp/opencode/pgdata -o "-p 5432 -k /tmp/opencode" start`
  (DATABASE_URL points to `postgresql://postgres:postgres@localhost:5432/laundry`). Push schemas for
  `laundry` and `laundry_test` with `DATABASE_URL=... ./node_modules/.bin/prisma db push` from
  `backend/` (do NOT add `--skip-generate`). Seed data (admin user, outlet, laundry services,
  products, plus 6 demo orders across every status incl. payments/trackings/cashflows) is created by
  `bun run src/infrastructure/seed/seed.ts`; demo orders are skipped when the DB already has orders.
