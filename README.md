# AC System Dynamic

Production scanning and traceability system for PT Global Anugerah Setia (PT GAS). The system connects BOM rules, production registrations, operator-selected lines, scan validation, monitoring, and Excel exports for Air Conditioner (AC) and Washing Machine (WM) production.

## Features

- Master data: product categories, models, lines, BOM rules, users, daily PIN, and UPH.
- Registration workflow: model, order number, PO, shift, plan, line/subline, and material references.
- Operator-selected line during registration; the user account `section` is not used to assign the line automatically.
- Typed AC and WM BOM validation with material prefixes, required fields, length, accuracy, duplicate, and plan checks.
- Stage validation for AC IDU/ODU and WM ASSY/PACKING lines.
- Production monitoring, history, PO summaries, and Excel exports.
- Session authentication with role and permission checks.
- Superuser-only Master Data and in-app system documentation at `/documentation`.

## Architecture

| Package | Stack | Path |
| --- | --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS | `apps/frontend` |
| Backend | Express 5, Prisma 6, PostgreSQL, Redis | `apps/backend` |

The repository is a pnpm/Turborepo workspace. The directories `FE-scanning-AC/` and `backend-ac/` are legacy references and should remain read-only.

## Requirements

- Node.js 20.9 or newer
- pnpm 11
- PostgreSQL
- Redis

## Local setup

```bash
pnpm install
cp apps/backend/.env.example apps/backend/.env
```

Set the backend values in `apps/backend/.env`:

```env
PORT=3010
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME?schema=public
REDIS_URL=redis://:PASSWORD@127.0.0.1:6379
```

For the frontend, set `apps/frontend/.env`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3010
```

When the frontend is opened from another machine, use the backend host instead,
for example `NEXT_PUBLIC_API_URL=http://192.128.69.69:3010`. If this variable
is omitted, the browser uses port `3010` on the host used to open the frontend.

Generate Prisma Client and apply migrations to the intended database:

```bash
cd apps/backend
pnpm exec prisma generate
pnpm exec prisma migrate deploy
```

> **Production warning:** the command above is for a correctly initialized test
> or staging database. Existing production databases must not run it directly.
> From `apps/backend`, use
> `./scripts/production-database-migration-wizard.sh` to verify identity, backup,
> restore/rehearse, baseline the verified history, and deploy only the pending
> additive migration. The wizard does not run backfill or legacy cleanup.

## Run locally

Run both applications from the repository root:

```bash
pnpm --filter backend-scan-prod dev
pnpm --filter frontend dev
```

Or use the workspace command:

```bash
pnpm dev
```

The default addresses are:

- Frontend: `http://localhost:3000`
- API: `http://localhost:3010`

## Test and build

Backend tests boot an in-process API and require a dedicated test database. The test helper rejects a `DATABASE_URL` that does not contain `test`.

```bash
cd apps/backend
pnpm test

cd ../frontend
pnpm exec tsc --noEmit
pnpm run build
pnpm run lint
```

Never point `.env.test` at a production database.

## Production flow

1. Create or verify product category, model, line, and BOM in **Master Data**.
2. Create a **Regist Scan** record with the correct model, order number, PO, shift, plan, and selected line.
3. Operator opens the registration and performs the configured scans.
4. Review results in **Data Scan** and export the required report.

Each section should use its own operator account. Registration blocking is scoped to the authenticated user, so an open IDU registration does not block a different ODU user using the same model.

## Line naming

Use the canonical subline names below. Stage validation relies on the complete name and the `INPUT`/`OUTPUT` distinction.

### AC

- `LINE IDU ASSY INPUT`
- `LINE IDU ASSY OUTPUT`
- `LINE ODU ASSY INPUT`
- `LINE ODU ASSY OUTPUT`
- `LINE IDU PACKING INPUT`
- `LINE ODU PACKING INPUT`
- Add TESTING or PACKING OUTPUT registrations only when those stages are used.

IDU and ODU may use the same model. Their stage validation remains separate.

### WM

- `LINE WM ASSY INPUT`
- `LINE WM ASSY OUTPUT`
- `LINE WM PACKING INPUT`
- `LINE WM PACKING OUTPUT`

WM `ASSY OUTPUT` is optional when that registration is not created. When it is created, it must follow `ASSY INPUT`; packing checks only the earlier stages that are registered for the batch.

## Roles

- **Superuser:** full master-data management, registrations, scan monitoring, exports, daily PIN, and documentation.
- **PPC/operator:** registration access within its user scope, line selection, and scan operations allowed by its permissions.

Destructive registration and scan edits/deletions require the configured PIN protection. Master-data changes affect subsequent registrations and scans.

## API overview

The API uses the session `HttpOnly` cookie. The frontend sends credentials automatically. The API base URL is configured with `NEXT_PUBLIC_API_URL`.

| Area | Main endpoints |
| --- | --- |
| Auth | `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` |
| Master data | `/model`, `/line`, `/bomlist`, `/product-categories`, `/users`, `/pin`, `/uph` |
| Registrations | `GET /registscan`, `GET /registscan/checkregist`, `POST /registscan/post`, `PUT /registscan/edit/:id`, `DELETE /registscan/delete/:id` |
| Scanning | `GET /rdps/scan`, `POST /rdps/post`, `POST /rdps/import`, `GET /rdps/history` |
| Dashboard | `GET /rdps/dashboard`, `GET /rdps/total-po-scan` |
| Exports | `GET /rdps/history.xlsx`, `GET /rdps/data-export.xlsx`, `GET /rdps/export-odf-po-all.xlsx` |

Scan and history requests use the `idregist` header when a registration ID is not sent in the request body. PIN-protected requests use `X-PIN` where applicable. The full reference is available to superusers at `/documentation`.

## Database and migration safety

- Use Prisma migrations as the schema source of truth.
- Validate migrations against the dedicated test database first.
- Do not apply destructive production migrations without a verified backup and explicit approval.
- Do not commit credentials, `.env` files, database dumps, or service-account keys.
