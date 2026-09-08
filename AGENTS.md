# AGENTS.md

## Layout

Single git repo, **two independent apps** — there is NO monorepo/workspace wiring. Each has its own
`package.json`, `bun.lock`, and `node_modules`. Always run commands from inside the app's directory
(`backend/` or `frontend/`), never from the repo root.

- `frontend/` — React 19 + Vite app (entry `src/main.tsx`). React Compiler via `@rolldown/plugin-babel`,
  **Tailwind CSS** with a crimson palette. `design/` holds the PNG UI mockups that are the source of
  truth for page/component structure; OCR the PNGs with `tesseract -l ind+eng` when you need their text.
- `backend/` — Hono API on Bun. Entry `src/index.ts`, listens on port 3000.
- `docs/` — API + architecture documentation (keep in sync with code).

Bun is the package manager and (for the backend) the runtime. Frontend lockfiles are also `bun.lock`
even though its scripts look npm-ish.

## Frontend conventions

- Styling is **Tailwind CSS** (@tailwindcss/vite plugin), palette tokens (crimson `#DC2626` primary,
  `#f3f4f6` surface, `#374151` text, `#111827` dark text). Do NOT add other CSS frameworks.
- Routing via `react-router-dom`. Layouts in `src/layouts/` (Guest / Customer / Admin), each with its own
  sidebar; pages in `src/pages/{public,customer,admin}/`; shared UI in `src/components/`.
- API client is a thin `fetch` wrapper in `src/services/` returning the backend envelope
  `{ success, status, message, data, meta? }`, with automatic access-token refresh. Auth state via
  `AuthContext` (`useAuth`); role-gate routes with the `ProtectedRoute` component.
- Order status flow used everywhere (as in the mockups):
  `BARU → DITERIMA → DIPROSES → SIAP_ANTAR → SELESAI` (+ `DIBATALKAN`).
- Brand: **Fadarosi**. Order IDs look like `CLN-YYYYMMDD-NNN`. Payment methods:
  `fadarosipay`, `transfer_bank` (VA), `cod`.

## Backend

- Dev server: `bun run dev` (runs `bun run --hot src/index.ts`).
- No build/test/lint/typecheck scripts exist on the backend. Verification is via a one-off
  `./node_modules/.bin/tsc --noEmit -p tsconfig.json` (TS 7 is installed in `node_modules`) plus
  running the server. Frontend has `bun run build` (`tsc -b && vite build`) and `bun run lint`.
- `bun`/`bunx` live at `~/.bun/bin` and may not be on PATH in a shell — use the full path or
  `export PATH="$HOME/.bun/bin:$PATH"`.

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
- API routes: `/api/v1/users`, `/api/v1/addresses`, `/api/v1/outlets`, `/api/v1/services`,
  `/api/v1/products`, `/api/v1/orders`, `/api/v1/payments`, `/api/v1/admin`; health check `/health`.

### Prisma (important quirks)

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
  `backend/.env` and set `DATABASE_URL` + a long random `JWT_SECRET` (env.ts fails fast on missing
  values — the server refuses to boot without them).
- Local PostgreSQL in this environment: a user-owned cluster may be started without sudo via
  `/usr/lib/postgresql/17/bin/pg_ctl -D /tmp/opencode/pgdata -o "-p 5432 -k /tmp/opencode" start`
  (DATABASE_URL points to `postgresql://postgres:postgres@localhost:5432/laundry`). Seed data
  (admin user, outlet, laundry services, products) is created by
  `bun run src/infrastructure/seed/seed.ts`.
