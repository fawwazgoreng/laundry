# AGENTS.md

## Layout

Single git repo, **two independent apps** — there is NO monorepo/workspace wiring. Each has its own
`package.json`, `bun.lock`, and `node_modules`. Always run commands from inside the app's directory
(`backend/` or `frontend/`), never from the repo root.

- `frontend/` — React 19 + Vite app (entry `src/main.tsx`). Uses the React Compiler via `@rolldown/plugin-babel`.
- `backend/` — Hono API on Bun. Entry `src/index.ts`, listens on port 3000.

Bun is the package manager and (for the backend) the runtime. Frontend lockfiles are also `bun.lock`
even though its scripts look npm-ish.

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
  `domain/repositories`; route wiring (`presentation/routes/userRoute.ts`) instantiates concrete
  `pg*Repository` classes.
- Security/error conventions in place: JWT access+refresh tokens via `hono/jwt` (NO extra jwt lib),
  tokens persisted in the `Access_token`/`Refresh_token` tables and rotated/revoked on
  login/refresh/logout, `Bun.password.hash` (argon2id) for passwords, zod validation in domain
  entities, per-route rate limiting, and a global `app.onError` that maps thrown `AppError`
  (also Prisma/Zod errors) to a consistent JSON envelope via `helper/errorHandling`.
- API is mounted under `/api/v1/users`; the health check is `/health`.

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
- Several backend source files are currently uncommitted work-in-progress (error handling, user
  registration/auth flow) — be aware the `main` branch's tracked code may lag the working tree.
