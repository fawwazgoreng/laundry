# Fadarosi Backend

Hono HTTP API for the Fadarosi laundry business system. It uses Bun, TypeScript, MySQL 8.4, and Prisma 8 RC in contract-first mode. The architecture is clean/hexagonal in style with a deliberate CQRS split for orders.

The full HTTP contract is in [`../docs/api.yml`](../docs/api.yml).

## ⚙️ Stack and runtime facts

| Concern   | Choice      |
| ---       | ---         |
| Runtime   | Bun / nodeJS|
| HTTP      | Hono 4      |
| Database  | MySQL       |
| ORM       | Prisma      |
| Validation| Zod 4       |
| Payments  | Midtrans    |

There is no root workspace manifest. Run backend commands from `backend/`, except Docker infrastructure commands which are run from the repository root.

## ⚙️ Setup

```bash
# from backend/
bun install --frozen-lockfile
cp .env.example .env
# edit .env with local values; never commit it

# from repository root
docker compose up db -d

# from backend/
bun run prisma contract emit
bun run prisma db init
bun run seed   # optional demo data
bun run dev
```

`bun run prisma:generate` runs `prisma contract emit` and writes ignored artifacts to `src/infrastructure/database/generated`. Run it before typechecking or first start on a fresh checkout. Docker regenerates the same artifacts during image build.

Environment is validated at import time in `src/config/env.ts`. `DATABASE_URL`, `JWT_SECRET` (minimum 16 characters), and all three Midtrans keys are required; the server refuses to boot without them. `.env.example` lists every supported name. `backend/.dockerignore` does not exclude `.env`, so do not bake real env files into images.

## 📜 Scripts

| Command | Purpose |
| --- | --- |
| `bun run dev` | Hot reload via `bun run --hot src/index.ts` |
| `bun run prod` | Run `src/index.ts` without hot reload |
| `bun run typecheck` | `tsc --noEmit -p tsconfig.json` |
| `bun run test` | Unit tests in `src/domain/entities` and `src/useCase` |
| `bun run test:unit` | Broader unit run over `src/` |
| `bun run test:integration` | Integration tests with `DATABASE_URL` overridden to a local `laundry_test` database |
| `bun run prisma:generate` | Emit the Prisma contract artifacts |
| `bun run seed` | Populate demo data |

Single test examples:

```bash
bun test src/domain/entities/userEntity.test.ts
bun test src/domain/entities/userEntity.test.ts -t 'accepts a valid registration'
```

`src/lib/distanceCalc.test.ts` is not included in `bun run test`; call it directly or use `bun run test:unit`. Integration tests wipe tables before inserting fixtures, so never point them at the development database. Two files, `src/useCase/payment/paymentUseCases.test.ts` and `src/useCase/user/userAuthUseCases.test.ts`, are zero-byte placeholders.

## 🗺️ Segment map

### Application bootstrap

| Path | Owns | Notes |
| --- | --- | --- |
| `src/index.ts` | Process composition root | Creates the Hono app, installs global middleware, mounts routers, serves `/health`, registers 404/error handlers, and default-exports `app`. The payment expiry worker and graceful shutdown only start when the file is run as main, so importing `app` in tests does not start background work. |
| `src/config/env.ts` | Validated environment | Zod schema with defaults for non-secret runtime settings. Import `env` from here, not `process.env` directly. |
| `src/infrastructure/config/env.ts` | Dead stub | Exports an unrelated `env = true`; do not use it. |

### Domain layer

| Path | Owns | Notes |
| --- | --- | --- |
| `src/domain/entities/` | Validation and business rules | Zod-backed static classes with `validateX(input)` methods that throw `AppError`. Includes `userEntity`, `orderEntity`, `paymentEntity`, `refundEntity`, `jwtTokenEntity`, `imageEntity`, `addressEntity`, `productEntity`, `serviceEntity`, and `addonEntity`. `orderEntity` owns the status machine; `paymentEntity` verifies Midtrans signatures. |
| `src/domain/repositories/` | Persistence contracts | Interfaces only, lower-camel names such as `orderRepository`, `userRepository`, and `tokenRepository`. Infrastructure provides the implementations. |
| `src/domain/types/` | Aggregate DTOs and enums | Enum values are exported const tuples such as `ORDER_STATUSES` and `PAYMENT_METHODS`. Shared pagination helpers live in `globalType.ts`. |

Domain code contains no SQL. Indonesian user-facing error messages are normal, and `exactOptionalPropertyTypes` means optional fields are often typed as `?: T | undefined`.

### Helpers and library code

| Path | Owns | Notes |
| --- | --- | --- |
| `src/helper/errorHandling/` | Errors and mappings | `AppError` factories, Zod/SQL/Midtrans error mapping, and the canonical JSON error body. |
| `src/helper/response/` | Success envelopes | `ok`, `created`, and `noContent` helpers. |
| `src/helper/http/` | Query/param parsing | `parseIdParam`, `parsePage`, and `parsePerPage` throw validation errors for bad input; `perPage` is capped at 100. |
| `src/helper/logging/` | Structured logs | JSON lines to stdout/stderr and a daily file with retention pruning. |
| `src/lib/money.ts` | Money representation | Branded 2-decimal strings with `Decimal` and `ROUND_HALF_UP`; API entry fields use `moneyInputSchema`. |
| `src/lib/distanceCalc.ts` | Haversine distance | Rounds to 2 decimals for MySQL `NUMERIC(6,2)` and enforces outlet coverage. |
| `src/types/temporal.d.ts` | Ambient Temporal types | Required by `temporal.UpdatedAt` in the Prisma contract. |

### Infrastructure layer

| Path | Owns | Notes |
| --- | --- | --- |
| `src/infrastructure/prisma/contract.prisma` | Database schema source of truth | Prisma 8 PSL contract. Money is stored as `sql.String(20)`, IDs use UUIDv7, and timestamps use Temporal types. |
| `src/infrastructure/prisma/prisma.ts` | ORM runtime | Builds Prisma from generated JSON, adds a UUIDv7 extension, and logs all SQL only in development. |
| `src/infrastructure/prisma/scalars.ts` | Scalar conversion | Helpers such as `varchar`, `numeric`, `flag`, `isFlag`, `jsonText`, and `fromJsonText`. |
| `src/infrastructure/database/generated/` | Generated contract types | Ignored by git and Docker; produced by `bun run prisma:generate`. Do not edit by hand. |
| `src/infrastructure/repository/` | Domain persistence adapters | `pg*Repository` classes implement domain interfaces. `pgOrderRepository` is the largest; `addonRowMapper.ts` normalizes addon rows. Use `prisma.transaction` for multi-table writes. |
| `src/infrastructure/jobs/paymentExpiryWorker.ts` | Background expiry job | Runs immediately and every 15 minutes with a re-entrancy guard. |
| `src/infrastructure/seed/seed.ts` | Demo data | Self-executing seed script run through `bun run seed`. |
| `src/infrastructure/src/` | Legacy generated output | Empty and gitignored; not the current contract output path. |

### Presentation layer

| Path | Owns | Notes |
| --- | --- | --- |
| `src/presentation/routes/container.ts` | Dependency injection | Constructs repositories, use cases, auth middleware, the expiry use case, and the Midtrans handler once at module scope. |
| `src/presentation/routes/` | HTTP routing | One Hono router per resource, mounted under `/api/...` in `src/index.ts`. Auth endpoints have a stricter 10/15m rate limit; other `/api/*` routes allow 300/15m. |
| `src/presentation/middleware/` | Cross-cutting HTTP behavior | `authMiddleware` reads `Authorization: Bearer <token>` and populates `c.user`/`c.userId`; `adminMiddleware` composes auth with a role check; `requestLogging` propagates `x-request-id`. |
| `src/presentation/controllers/` | HTTP adapters | Parse params/queries/bodies, call one use case, and return `ok`/`created`/`noContent`. The Midtrans webhook deliberately returns plain `OK`. |
| `src/presentation/types.ts` | Hono context variables | Declares `AppVariables` used by the typed Hono app. |

### Use cases

| Path | Owns | Notes |
| --- | --- | --- |
| `src/useCase/user/` | Auth and profile | Register, login, refresh, logout, profile update, and `AuthUseCase.authenticate` for middleware. |
| `src/useCase/address/`, `outlet/`, `service/`, `product/`, `addon/` | Catalog and account CRUD | Class-per-action pattern: validate entity, call repository, handle not-found, log. |
| `src/useCase/order/commands/`, `queries/` | Order writes and reads | Create, cancel, delete, status update, get, and list. Re-exported from `src/useCase/order/index.ts`. Create selects the farthest outlet, checks coverage, computes totals, and optionally charges Midtrans. |
| `src/useCase/payment/` | Payment state | Midtrans notification handling and expiry of pending payments after 24 hours. |
| `src/useCase/refund/` | Refund workflow | Eligibility rules include a 7-day window; approve/reject writes cashflow and payment state. |
| `src/useCase/admin/` | Reporting | Dashboard stats and cashflow summary. |

Every use case exposes `execute(...)` except `AuthUseCase.authenticate`. Use cases throw `AppError.*`, never build HTTP responses.

### Tests and runtime artifacts

| Path | Owns | Notes |
| --- | --- | --- |
| `src/**/*.test.ts` | Co-located unit tests | Entity, use case, refund validator, and distance tests using `bun:test`. |
| `tests/integration/` | API integration tests | Uses `app.request()` against the real Hono app, resets a dedicated test DB, and closes Prisma in `afterAll`. |
| `public/uploads/products/` | Uploaded product images | Written by `imageEntity.save` and served from `/uploads/*`. |
| `logs/` | Runtime logs | Daily `app-YYYY-MM-DD.log` files; gitignored. |

### Root files

| Path | Owns | Notes |
| --- | --- | --- |
| `package.json` | Scripts and dependencies | Bun-only scripts; `bun.lock` is authoritative. |
| `prisma.config.ts` | Prisma 8 contract config | Source `src/infrastructure/prisma/contract.prisma`, output `src/infrastructure/database/generated`, DB URL from `DATABASE_URL`. |
| `Dockerfile` | Container build | `oven/bun:1-slim`, frozen Bun install, contract emit, exposes 3000, runs `bun run dev`. |
| `.dockerignore` | Build context filtering | Excludes `node_modules`, logs, tests, README, generated DB output, and migrations, but not `.env`. |
| `.env.example` | Environment template | Lists all environment names with placeholders. |
| `tsconfig.json` | TypeScript config | Strict flags including `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, Bun types, and Hono JSX settings. |

## 🌐 HTTP conventions

- Success responses use `{ success, message, data, meta? }`; `created` uses status 201 and `noContent` uses 204.
- Errors use `{ success, status, message, code, path, requestId, details? }`.
- Zod failures map to 422 `VALIDATION_ERROR`; malformed JSON maps to 400; database conflicts and connection failures map through `src/helper/errorHandling/errorMappings.ts`.
- `/health` performs a real DB query with a 3 second timeout and is outside the `/api/*` rate limiter.
- `/uploads/*` is served from `./public` and is also outside the API rate limiter.
- Image uploads enforce a 3 MB route body limit and a 2 MB JPG/JPEG/PNG/WEBP check in `imageEntity.save`.

## 🔄 Request lifecycle

```text
HTTP request
  -> secureHeaders -> cors -> requestLogging
  -> /api/* rate limiter (except /health and /uploads/*)
  -> route middleware (auth or admin, where applicable)
  -> controller parses input
  -> use case validates via domain entity and orchestrates repositories
  -> repository maps rows to domain types
  -> controller returns ok/created/noContent
  -> onError maps thrown AppError/unknown errors to the common error body
```

See `../docs/api.yml` for every endpoint, parameter, request body, and response shape.
