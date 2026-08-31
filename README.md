# NestJS Secure — Production-Grade Backend Template

A battle-hardened NestJS backend foundation built for large teams and long-term maintainability. Uses Bun as the runtime, TypeScript strict mode, and clean architecture principles throughout.

---

## Documentation

| Document | What it covers |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Deep technical reference — layers, request lifecycle, security model, design decisions |
| [WORKING.md](WORKING.md) | Day-to-day coding guide — where files go, how to add a feature, naming rules, forbidden patterns |

Start with **[WORKING.md](WORKING.md)** if you're new to the project. Read **[ARCHITECTURE.md](ARCHITECTURE.md)** when you need to understand *why* things are built the way they are.

---

## Architecture Overview

```
src/
├── core/                    # Cross-cutting concerns (global guards, filters, interceptors)
│   ├── decorators/          # @Public(), @CurrentUser()
│   ├── filters/             # GlobalExceptionFilter — Prisma errors → HTTP codes
│   ├── guards/              # JwtAuthGuard — default-deny, opt-out via @Public()
│   └── interceptors/        # CorrelationId, Transform (response envelope), Logging
│
├── database/
│   └── prisma/              # PrismaService (global singleton)
│
├── modules/                 # Domain feature modules — add new domains here
│   ├── auth/                # Login, Register, JWT + Local strategies
│   └── users/               # CRUD, repository pattern, paginated list
│
└── shared/                  # Zero business logic — utilities, types, config
    ├── config/              # Zod-validated env schemas (app, database, jwt)
    ├── constants/           # Shared string/number constants
    ├── types/               # Shared TypeScript interfaces (ApiResponse, Pagination)
    └── utils/               # Pure functions (hash, pagination)
```

**Rules enforced by convention:**
- `core/` never imports from `modules/`
- `shared/` never imports from `core/` or `modules/`
- Business logic lives only in services, never controllers or repositories
- Controllers own HTTP shape only — no logic, no direct DB access
- Repositories own SQL/ORM only — no business rules

---

## Security Defaults

| Control | Implementation |
|---|---|
| Secure headers | Helmet with strict CSP, HSTS, no-sniff, frame-deny |
| Rate limiting | `@nestjs/throttler` — 100 req/min, configurable per env |
| CORS | Explicit allowlist from `CORS_ORIGINS` env var |
| Auth | JWT default-deny, `@Public()` to opt out |
| Input validation | `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true` |
| Mass assignment | Unknown fields rejected at the pipe layer |
| Password storage | bcrypt with 12 rounds |
| Error leakage | Detailed messages hidden in production |
| Sensitive log redact | Authorization headers and passwords auto-redacted by Pino |
| Secrets validation | Zod schemas fail-fast at startup with clear messages |

---

## Getting Started

### Prerequisites
- [Bun](https://bun.sh) >= 1.0
- [Docker](https://docs.docker.com/get-docker/) (Compose v2) — for Postgres and optional full-stack runs

### Setup

```bash
# 1. Install dependencies
bun install

# 2. Copy environment template
cp .env.example .env
# Edit .env — fill in JWT secrets (DATABASE_URL already points at Compose Postgres)

# 3. Start Postgres
bun run docker:up
# → localhost:5434 / dev_db (credentials from DEV_DB_* in .env)

# 4. Generate Prisma client & run migrations
bun run prisma:generate
bun run prisma:migrate

# 5. Start development server
bun run dev
```

The server starts at `http://localhost:3000`. All routes are prefixed with `/api/v1/`.

### Docker

| Command | What it does |
|---|---|
| `bun run docker:up` | Start dev Postgres (`dev-db` on host port **5434**) |
| `bun run docker:down` | Stop Compose services |
| `bun run docker:test-db` | Start ephemeral test Postgres (`test-db` on **5435**) |
| `bun run docker:app` | Build & run the API container + Postgres (`--profile app`) |

**Full stack (API in Docker):**

```bash
cp .env.example .env   # set JWT_SECRET / JWT_REFRESH_SECRET (≥32 chars)
bun run docker:app
# API → http://localhost:3000  (runs migrations on start)
```

**Image only:**

```bash
docker build -t nest-secure .
docker run --rm -p 3000:3000 --env-file .env \
  -e DATABASE_URL=postgresql://devuser:changeme@host.docker.internal:5434/dev_db?schema=public \
  nest-secure
```

---

## Scripts

| Command | What it does |
|---|---|
| `bun run dev` | Start with hot-reload |
| `bun run build` | Compile to `dist/` |
| `bun run start` | Run compiled production build |
| `bun run lint` | ESLint check |
| `bun run lint:fix` | ESLint auto-fix |
| `bun run typecheck` | TypeScript type check (no emit) |
| `bun run test` | Pactum API tests (requires DB) |
| `bun run test:cov` | API tests with coverage report |
| `bun run test:e2e` | Alias for `bun run test` |
| `bun run prisma:migrate` | Apply pending migrations |
| `bun run prisma:studio` | Open Prisma Studio |
| `bun run docker:up` | Start Compose Postgres (dev) |
| `bun run docker:down` | Stop Compose services |
| `bun run docker:test-db` | Start Compose Postgres (test profile) |
| `bun run docker:app` | Build & run API + Postgres |

---

## API Reference

### Auth (public endpoints)

```
POST /api/v1/auth/register   — Create account, returns JWT
POST /api/v1/auth/login      — Authenticate, returns JWT
```

### Users (JWT required)

```
GET    /api/v1/users         — List users (paginated)
GET    /api/v1/users/me      — Authenticated user's profile
GET    /api/v1/users/:id     — Single user by ID
POST   /api/v1/users         — Create user (admin)
PATCH  /api/v1/users/:id     — Update user (own or admin)
DELETE /api/v1/users/:id     — Delete user (own or admin)
```

### Response envelope

Every response is wrapped:
```json
{
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "correlationId": "uuid",
    "version": "v1"
  }
}
```

Errors follow:
```json
{
  "statusCode": 400,
  "message": ["email must be an email"],
  "error": "BAD_REQUEST",
  "correlationId": "uuid",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/auth/register"
}
```

---

## Adding a New Domain Module

```bash
# 1. Create the directory
mkdir -p src/modules/products/{dto,entities,repositories}

# 2. Implement the files following the users/ module as reference
#    - entities/product.entity.ts
#    - dto/create-product.dto.ts
#    - dto/update-product.dto.ts
#    - repositories/products.repository.ts
#    - products.service.ts
#    - products.controller.ts
#    - products.module.ts

# 3. Register in AppModule
# imports: [..., ProductsModule]
```

---

## Testing Strategy

API tests use **Pactum** (Bun runs `describe`/`it`). They live in `test/*.spec.ts` and hit the real HTTP stack against PostgreSQL.

**Patterns:**
- One `describe` per resource, nested `describe` per HTTP method
- Await `pactum.spec()` chains — assert with `.expectStatus()` / `.expectJsonLike()`
- Scope test data with identifiable emails (e.g., `@e2e.test`) and clean up in `afterAll`
- Store tokens with `.stores('userAt', 'data.accessToken')` and reuse via `$S{userAt}`
- Cover validation (400), auth (401), conflict (409), and happy path

Coverage threshold: **70%** of functions and lines (enforced in `bunfig.toml`).

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Runtime environment |
| `PORT` | No | `3000` | HTTP port |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string |
| `JWT_SECRET` | **Yes** | — | Min 32 chars |
| `JWT_EXPIRES_IN` | No | `7d` | Access token TTL |
| `JWT_REFRESH_SECRET` | No | — | Min 32 chars |
| `CORS_ORIGINS` | No | `` | Comma-separated allowed origins |
| `LOG_LEVEL` | No | `info` | trace/debug/info/warn/error/fatal |
| `THROTTLE_TTL` | No | `60` | Rate limit window (seconds) |
| `THROTTLE_LIMIT` | No | `100` | Max requests per window |

---

## Git Workflow

### Branch strategy
```
main          — production, always deployable
development   — integration branch for completed features
feature/*     — one feature per branch, PR into development
fix/*         — bug fix branches
```

### Commit convention (enforced by Commitlint)

```
feat: add product search endpoint
fix: resolve JWT expiry edge case
docs: update API reference
refactor: extract pagination to shared utility
test: add users service edge case coverage
```

Types: `feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`

### Husky hooks

| Hook | Runs | Blocks merge if... |
|---|---|---|
| `pre-commit` | lint-staged | ESLint or Prettier violations |
| `commit-msg` | Commitlint | Commit message fails convention |
| `pre-push` | typecheck + tests | Type errors or failing tests |

---

## CI/CD

**`.github/workflows/ci.yml`** — runs on every PR/push to `main` or `development`, plus a weekly schedule:

**CI job** — lint, typecheck, tests, build:
1. Install deps (Bun, cached)
2. Generate Prisma client
3. Run migrations against test Postgres service
4. Lint → Typecheck → API tests + coverage → Build
5. Upload coverage report as a workflow artifact

**Security jobs** (same workflow):
1. `bun audit` for vulnerable dependencies
2. Semgrep static analysis for JS/TS security patterns
3. Gitleaks secret scanning on full git history

---

## Contribution Guidelines

1. Branch from `development`, not `main`
2. Keep PRs focused — one concern per PR
3. All new endpoints must have Pactum tests with the happy path + at least one error path
4. No `console.log` — use the injected `Logger` from `@nestjs/common`
5. No raw SQL — use Prisma queries through the repository layer
6. Never put business logic in controllers or repositories
7. All environment access must go through `ConfigService`, never `process.env` directly
