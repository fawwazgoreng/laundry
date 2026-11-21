# 🫧 FADAROSI

> "Built on Demand. Rising with precision."

FADAROSI is a laundry business system: a Bun/Hono API backed by MySQL and a React single-page app for customers and administrators.

## 🗺️ Repository map

This repository has two independent Bun apps and no root package manifest.

| Path | Role | Documentation |
| --- | --- | --- |
| `backend/` | Hono API, domain logic, Prisma 8 MySQL contract, repositories, use cases, background jobs, seed data | [`backend/README.md`](backend/README.md) |
| `frontend/` | Vite 8 + React 19 SPA, customer/admin UI, API client, maps, reports, Playwright smoke tests | [`frontend/README.md`](frontend/README.md) |
| `docs/api.yml` | OpenAPI 3.1 specification for the HTTP API | [`docs/api.yml`](docs/api.yml) |
| `docs/report.docx` | Formal project report and functional requirements | binary document |
| `design/` | PNG exports of landing, auth, customer, and admin screens | binary design references |
| `docker-compose.yml` | Root orchestration for MySQL, backend, frontend, and optional ngrok | this file |
| `.env` | Local Compose variables; ignored by git | do not commit |

`docs/report.docx` is useful for domain vocabulary and functional requirements, but it still describes PostgreSQL in places. The running stack uses MySQL 8.4 as configured in `docker-compose.yml` and `backend/prisma.config.ts`.

## 🚀 Quick start

```bash
# from repository root
docker compose up db -d

# backend: install, configure, generate, initialize DB
cd backend
bun install --frozen-lockfile
cp .env.example .env
bun run prisma:generate
bunx prisma db init
bun run seed      # optional demo data
bun run dev       # http://localhost:3000

# frontend
cd frontend
bun install --frozen-lockfile
bun run dev       # http://localhost:5173
```

`bun.lock` in each app is authoritative; do not use npm install flows. The backend validates required environment variables at import time, including `DATABASE_URL`, `JWT_SECRET`, and Midtrans keys. See `backend/.env.example` for names only.

To run the full Compose stack, `docker compose up` also starts ngrok and requires `NGROK_AUTHTOKEN`. For database-only local development, use `docker compose up db -d`.

## 🔒 Verification

```bash
# backend
cd backend
bun run prisma:generate
bun run typecheck
bun run test
bun run test:integration   # requires a separate laundry_test MySQL database

# frontend
cd frontend
bun run build
bun run lint
bun test tests/unit
```

Frontend E2E additionally requires a prior `bun run build`, free ports 3000/4173, a ready backend/database, and an explicit `E2E_DATABASE_URL`.

## 🏗️ Architecture at a glance

```text
Browser (React SPA, port 5173)
  -> /api calls go directly to http://localhost:3000/api
  -> /uploads is proxied by Vite in dev and by nginx in production

Backend (Hono, port 3000)
  -> routes/controllers parse and authorize HTTP input
  -> use cases validate entities and orchestrate business rules
  -> domain repositories define persistence contracts
  -> Prisma repositories map MySQL rows to domain types
  -> Midtrans webhook updates payments/cashflow
  -> expiry worker cancels stale pending payments

Database (MySQL 8.4, port 3306)
  -> contract source: backend/src/infrastructure/prisma/contract.prisma
  -> generated output: backend/src/infrastructure/database/generated
```

Success responses use `{ success, message, data, meta? }`. Errors use `{ success, status, message, code, path, requestId, details? }`, except the Midtrans webhook and a few upload errors. Money is transported as 2-decimal strings on both sides.

## 📄 API documentation

The OpenAPI file at [`docs/api.yml`](docs/api.yml) documents the endpoints currently mounted by `backend/src/index.ts`, including parameters, request bodies, auth requirements, and response envelopes. To preview it locally:

```bash
npx @redocly/cli preview-docs docs/api.yml
```

## 🤝 Contributing

1. Fork this repository
2. Create a feature branch

```bash
git checkout -b feat/your-feature
```

3. Commit your changes

```bash
git commit -m "feat: add your feature"
```

4. Push to the branch

```bash
git push origin feat/your-feature
```

5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

<div align="center">

Made with ❤️ by  
**Muhammad Fawwaz Almumtaz**

</div>
