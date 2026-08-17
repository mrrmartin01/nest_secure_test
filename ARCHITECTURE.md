# Architecture Reference

This document is the authoritative technical reference for the `nest_secure` backend template. It explains every structural decision, what each layer does, and why it was built this way. Read this before touching the codebase.

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Full Folder Structure](#2-full-folder-structure)
3. [Layer Responsibilities](#3-layer-responsibilities)
4. [Module Anatomy](#4-module-anatomy)
5. [Core Module — Global Infrastructure](#5-core-module--global-infrastructure)
6. [Security Architecture](#6-security-architecture)
7. [Request Lifecycle](#7-request-lifecycle)
8. [Configuration System](#8-configuration-system)
9. [Database Layer](#9-database-layer)
10. [Logging & Observability](#10-logging--observability)
11. [Testing Architecture](#11-testing-architecture)
12. [Error Handling](#12-error-handling)
13. [Response Shape](#13-response-shape)
14. [CI/CD Pipeline](#14-cicd-pipeline)
15. [Key Architectural Decisions](#15-key-architectural-decisions)

---

## 1. High-Level Overview

This project is built on **NestJS 11** using **Bun** as the runtime and package manager. The architecture follows three principles simultaneously:

- **Clean Architecture** — layers with strict import rules; business logic never bleeds across layer boundaries
- **Domain-Driven Modular Structure** — features are grouped by business domain, not by technical type
- **Security-First Design** — protection is the default; developers opt out of it, not into it

The application is structured into four zones:

```
┌─────────────────────────────────────────────────────────────┐
│  CORE          Global guards, filters, interceptors          │
│  (Infrastructure concerns applied to every request)         │
├─────────────────────────────────────────────────────────────┤
│  MODULES       auth / users / products / orders / ...        │
│  (Domain feature modules — one folder per business domain)  │
├─────────────────────────────────────────────────────────────┤
│  SHARED        Config, types, constants, pure utilities      │
│  (Zero business logic — imported by everyone, imports nobody)│
├─────────────────────────────────────────────────────────────┤
│  DATABASE      PrismaService (global singleton)              │
│  (Single point of database access for all repositories)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Full Folder Structure

```
nest_secure/
│
├── .github/
│   └── workflows/
│       ├── ci.yml              # Lint → Typecheck → Tests → Build on every PR
│       └── security.yml        # Dependency audit + CodeQL + secret scanning
│
├── .husky/
│   ├── pre-commit              # Runs lint-staged (ESLint + Prettier on staged files)
│   ├── commit-msg              # Runs commitlint (enforces conventional commits)
│   └── pre-push               # Runs typecheck + tests (blocks broken pushes)
│
├── prisma/
│   ├── schema.prisma           # Single source of truth for the database schema
│   └── migrations/             # SQL migrations applied by Prisma CLI
│
├── prisma.config.ts            # Prisma 7 CLI datasource (DATABASE_URL)
│
├── src/
│   │
│   ├── core/                   ← GLOBAL INFRASTRUCTURE (applied to every request)
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts     # @CurrentUser() param decorator
│   │   │   └── public.decorator.ts           # @Public() route decorator
│   │   ├── filters/
│   │   │   └── global-exception.filter.ts    # Catches all errors; maps to HTTP codes
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts             # Default-deny JWT guard
│   │   ├── interceptors/
│   │   │   ├── correlation-id.interceptor.ts # Stamps every request with a trace ID
│   │   │   ├── logging.interceptor.ts        # Logs handler duration
│   │   │   └── transform.interceptor.ts      # Wraps all responses in {data, meta}
│   │   └── core.module.ts                    # Registers above via APP_* providers
│   │
│   ├── database/               ← DATABASE INFRASTRUCTURE
│   │   └── prisma/
│   │       ├── prisma.module.ts              # Exports PrismaService globally
│   │       └── prisma.service.ts             # PrismaClient lifecycle management
│   │
│   ├── modules/                ← DOMAIN FEATURE MODULES (add new features here)
│   │   │
│   │   ├── auth/
│   │   │   ├── dto/
│   │   │   │   ├── login.dto.ts
│   │   │   │   └── register.dto.ts
│   │   │   ├── guards/
│   │   │   │   └── local-auth.guard.ts       # Used only on POST /auth/login
│   │   │   ├── strategies/
│   │   │   │   ├── jwt.strategy.ts           # Validates Bearer tokens
│   │   │   │   └── local.strategy.ts         # Validates email+password
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.module.ts
│   │   │
│   │   └── users/
│   │       ├── dto/
│   │       │   ├── create-user.dto.ts        # Inbound: validated + sanitized
│   │       │   ├── update-user.dto.ts        # Partial of create, minus password
│   │       │   └── user-response.dto.ts      # Outbound: explicit field allowlist
│   │       ├── entities/
│   │       │   └── user.entity.ts            # DB row shape + @Exclude password
│   │       ├── repositories/
│   │       │   └── users.repository.ts       # All DB queries live here
│   │       ├── users.controller.ts
│   │       ├── users.service.ts
│   │       └── users.module.ts
│   │
│   ├── shared/                 ← SHARED KERNEL (zero business logic)
│   │   ├── config/
│   │   │   ├── app.config.ts                 # Zod-validated app env schema
│   │   │   ├── database.config.ts            # Zod-validated DB env schema
│   │   │   └── jwt.config.ts                 # Zod-validated JWT env schema
│   │   ├── constants/
│   │   │   └── index.ts                      # Shared string/number constants
│   │   ├── types/
│   │   │   ├── api-response.types.ts         # ApiResponse, JwtPayload, RequestUser
│   │   │   └── pagination.types.ts           # PaginationQuery, PaginatedResult
│   │   ├── utils/
│   │   │   ├── hash.util.ts                  # hashPassword, comparePassword
│   │   │   └── pagination.util.ts            # buildPaginationMeta, toPrismaSkipTake
│   │   └── shared.module.ts
│   │
│   ├── app.module.ts           # Root module — imports everything, owns nothing
│   └── main.ts                 # Bootstrap: Helmet, CORS, ValidationPipe, Pino
│
├── test/
│   └── app.spec.ts             # Pactum API tests against a real DB
│
├── .env.example                # Every env var documented with types and defaults
├── .gitignore
├── .lintstagedrc.js
├── .prettierrc
├── bunfig.toml                 # Bun test timeout + coverage threshold
├── commitlint.config.js
├── eslint.config.mjs
├── nest-cli.json
├── package.json
├── tsconfig.json               # strict: true + path aliases
├── tsconfig.build.json
├── ARCHITECTURE.md             # ← This file
├── WORKING.md                  # ← Developer coding guide
└── README.md                   # Quick-start and API reference
```

---

## 3. Layer Responsibilities

### Strict Import Rules

| Layer | May import from | Must never import from |
|---|---|---|
| `core/` | `shared/` | `modules/`, `database/` |
| `modules/*/controllers` | `modules/*/services`, `modules/*/dto`, `core/decorators`, `shared/types` | repositories, entities, other modules' internals |
| `modules/*/services` | `modules/*/repositories`, `shared/utils`, `shared/types` | controllers, other modules' repositories |
| `modules/*/repositories` | `database/prisma`, `modules/*/entities`, `shared/utils`, `shared/types` | services, controllers |
| `shared/` | nothing from this project | `core/`, `modules/`, `database/` |
| `database/` | `@prisma/client` | `modules/`, `shared/`, `core/` |

Violating these rules causes **coupling** — changes in one domain force changes in another. ESLint can be extended with `eslint-plugin-boundaries` to enforce this automatically.

---

## 4. Module Anatomy

Every domain module follows the same internal structure. Using `users/` as the canonical example:

```
users/
├── dto/                    # Data Transfer Objects
│   ├── create-user.dto.ts  # What the API accepts on POST /users
│   ├── update-user.dto.ts  # What the API accepts on PATCH /users/:id
│   └── user-response.dto.ts# What the API returns (explicit allowlist)
│
├── entities/
│   └── user.entity.ts      # Mirrors the Prisma User model; adds @Exclude/@Expose
│
├── repositories/
│   └── users.repository.ts # All Prisma queries; returns UserEntity instances
│
├── users.service.ts        # Business logic; calls repository; throws HTTP exceptions
├── users.controller.ts     # HTTP routing only; calls service; returns response DTOs
└── users.module.ts         # Declares providers, exports UsersService for AuthModule
```

**Data flow (inbound):**
```
HTTP Request
  → ValidationPipe (strips unknown fields, transforms types)
  → Controller (extracts params, calls service)
  → Service (applies business rules, calls repository)
  → Repository (executes query, returns Entity)
  → Service (returns Entity to controller)
  → Controller (maps Entity → ResponseDTO)
  → TransformInterceptor (wraps in {data, meta})
  → ClassSerializerInterceptor (applies @Exclude)
  → HTTP Response
```

---

## 5. Core Module — Global Infrastructure

`CoreModule` is registered once in `AppModule` and applies its providers globally using NestJS's `APP_*` tokens. This means the providers have full access to the DI container — unlike registering in `main.ts` which creates instances outside of DI.

```typescript
// Execution order on every request:
APP_GUARD        → JwtAuthGuard         (blocks unauthenticated requests first)
APP_FILTER       → GlobalExceptionFilter (catches any thrown exception)
APP_INTERCEPTOR  → CorrelationIdInterceptor  (stamps request with trace ID)
APP_INTERCEPTOR  → LoggingInterceptor        (records handler duration)
APP_INTERCEPTOR  → TransformInterceptor      (wraps response in {data, meta})
APP_INTERCEPTOR  → ClassSerializerInterceptor (strips @Exclude fields)
```

**Why APP_* over useGlobalGuards/useGlobalFilters in main.ts?**
Providers registered via `APP_*` participate in the NestJS DI container. They can inject services (e.g., `Reflector`, `ConfigService`). Providers registered in `main.ts` are instantiated outside DI and cannot inject anything.

---

## 6. Security Architecture

### Default-Deny Authentication

The `JwtAuthGuard` is registered as `APP_GUARD`. Every route requires a valid JWT unless the handler or controller is decorated with `@Public()`.

```
New route without @Public() → PROTECTED (safe default)
New route with @Public()    → PUBLIC    (explicit opt-out)
```

This inverts the risk: forgetting to protect a route is impossible. Forgetting to mark a public route causes an auth error — visible and caught in testing.

### Input Validation (Mass Assignment Prevention)

`ValidationPipe` runs globally with:
- `whitelist: true` — strips any property not declared in the DTO class
- `forbidNonWhitelisted: true` — throws `400 Bad Request` if unknown properties are sent

A caller cannot inject `role: ADMIN` into a registration endpoint unless `role` is explicitly declared in `RegisterDto`.

### Password Security

- Hashed with **bcrypt at 12 rounds** before any DB write
- `@Exclude()` on `UserEntity.password` — never serialized into any response
- Dedicated `hashPassword` / `comparePassword` utilities in `shared/utils/hash.util.ts`
- Password changes require a dedicated endpoint (not possible through `UpdateUserDto`)

### Security Headers (Helmet)

Applied in `main.ts` before any routing:

| Header | Value |
|---|---|
| `Content-Security-Policy` | Strict — `default-src 'self'`, no inline scripts |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Powered-By` | Removed |

### Rate Limiting

`ThrottlerModule` is configured in `AppModule` and enforced globally (100 requests per 60 seconds by default, configurable via env). Use `@SkipThrottle()` on routes that should be exempt (e.g., health checks).

### CORS

Only origins listed in `CORS_ORIGINS` (comma-separated env var) are allowed. An empty `CORS_ORIGINS` means all cross-origin requests are blocked.

### Error Response Sanitization

`GlobalExceptionFilter` never exposes stack traces or internal error messages in production (`NODE_ENV=production`). `ValidationPipe`'s `disableErrorMessages` flag is `true` in production.

---

## 7. Request Lifecycle

```
Incoming HTTP Request
        │
        ▼
  [Middleware]
  - Helmet (security headers)
  - pino-http (request logging starts)
        │
        ▼
  [Guards]
  1. JwtAuthGuard (APP_GUARD)
     - If @Public() → passes
     - If valid Bearer token → attaches RequestUser to request
     - If invalid/missing token → throws UnauthorizedException
  2. ThrottlerGuard (built into ThrottlerModule)
        │
        ▼
  [Interceptors — PRE-HANDLER]
  1. CorrelationIdInterceptor → reads/generates X-Correlation-ID
  2. LoggingInterceptor       → records start timestamp
  3. TransformInterceptor     → sets up response wrapper
  4. ClassSerializerInterceptor → prepares @Exclude processing
        │
        ▼
  [Pipes]
  - ValidationPipe → validates & transforms DTO, strips unknown fields
        │
        ▼
  [Route Handler]
  - Controller method executes
  - Calls service → service calls repository → repository queries DB
  - Returns response DTO
        │
        ▼
  [Interceptors — POST-HANDLER]
  4. ClassSerializerInterceptor → applies @Exclude/@Expose
  3. TransformInterceptor       → wraps in { data, meta }
  2. LoggingInterceptor         → logs handler duration
  1. CorrelationIdInterceptor   → sets X-Correlation-ID response header
        │
        ▼
  [Exception Filter — if any error thrown above]
  - GlobalExceptionFilter maps error → HTTP status + clean message
        │
        ▼
  HTTP Response
  - pino-http logs response status + duration
```

---

## 8. Configuration System

Configuration is structured, validated, and typed — never accessed raw from `process.env`.

### How it works

1. Each config namespace (`app`, `database`, `jwt`) has a dedicated file in `src/shared/config/`
2. Each file defines a Zod schema that validates the relevant `process.env` keys
3. If validation fails, the process throws immediately with a human-readable error
4. `ConfigModule.forRoot({ load: [...] })` in `AppModule` registers all namespaces
5. Any service injects `ConfigService` and reads typed values via `config.get<T>('namespace.key')`

### Accessing config

```typescript
// ✅ Correct
constructor(private readonly config: ConfigService) {}

const port = this.config.get<number>('app.port');
const secret = this.config.get<string>('jwt.secret');

// ❌ Never do this
const port = process.env.PORT;
```

### Adding a new config namespace

1. Create `src/shared/config/your-feature.config.ts`
2. Define a Zod schema for the env vars it needs
3. Export a `registerAs('your-feature', () => { ... })` factory
4. Add to `.env.example`
5. Register in `AppModule`'s `ConfigModule.forRoot({ load: [...] })`

---

## 9. Database Layer

### Prisma Service

`PrismaService` extends `PrismaClient` and is provided globally by `PrismaModule`. Every repository injects it directly — there is no abstraction between the repository and Prisma.

### Repository Pattern

Services never call Prisma directly. They call a repository. The repository is the only place where `this.prisma.user.findMany(...)` etc. appear.

```
UsersService → UsersRepository → PrismaService → PostgreSQL
```

### Entity Mapping

Repositories always return `UserEntity` instances (not raw Prisma objects). This ensures `@Exclude`/`@Expose` decorators from `class-transformer` always apply, and the serialization behaviour is consistent everywhere.

### Transactions

Use `this.prisma.$transaction([...])` inside repositories for multi-step operations that must succeed or fail together. Never split a logical transaction across two repository calls from the service layer.

### Migrations

```bash
# Create a new migration (generates SQL + updates DB)
bun run prisma:migrate

# Apply migrations in CI/production (no new migration creation)
bunx prisma migrate deploy
```

Never modify migration files after they have been applied to any environment. Create a new migration instead.

---

## 10. Logging & Observability

### Pino (via nestjs-pino)

All logs are structured JSON in production. In development, `pino-pretty` formats them for readability.

Every HTTP request is automatically logged by `pino-http` with:
- `method`, `url`, `statusCode`, `responseTime`
- `correlationId` (from `X-Correlation-ID` header)
- Authorization headers and request body passwords are **auto-redacted**

### Correlation IDs

Every request receives an `X-Correlation-ID` header — either from the caller (for distributed tracing) or generated as a UUID. The ID propagates through:
- The request headers (readable by any handler)
- The response headers (visible to the caller)
- Every log line emitted during that request's lifecycle
- Every error response body

### Using the Logger

```typescript
// ✅ Correct — inject NestJS Logger, not nestjs-pino directly
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  doSomething(): void {
    this.logger.log('User created');          // info
    this.logger.warn('Suspicious input');     // warn
    this.logger.error('DB write failed');     // error
  }
}

// ❌ Never use console.log (ESLint rule enforces this)
```

---

## 11. Testing Architecture

### API Tests (`test/*.spec.ts` — Pactum against real DB)

Bun is the runner (`describe`/`it`). Pactum is the HTTP client and assertion library. Tests exercise the full stack: request → guard → pipe → handler → response envelope.

- One outer `describe` per resource, nested `describe` per HTTP method
- Real PostgreSQL (test database)
- Test data scoped with identifiable emails (e.g., `@e2e.test`) and cleaned up in `afterAll`
- Cover: validation (400), auth (401), forbidden (403), not found (404), conflict (409), and success
- Persist JWTs with `.stores()` and reuse them via `$S{storeName}`

```typescript
describe('POST /auth/register', () => {
  it('should throw if form is empty', async () => {
    await pactum.spec().post('/auth/register').withBody({}).expectStatus(400);
  });

  it('should pass signup', async () => {
    await pactum
      .spec()
      .post('/auth/register')
      .withBody(signupDto)
      .expectStatus(201)
      .stores('userAt', 'data.accessToken');
  });
});
```

### Coverage Threshold

70% of functions and lines. CI fails below this (`bunfig.toml`). Raise the threshold as the codebase matures.

---

## 12. Error Handling

All errors flow through `GlobalExceptionFilter`. It handles three categories:

| Error type | Source | HTTP response |
|---|---|---|
| `HttpException` | NestJS + application code | Uses the exception's status and message |
| `Prisma.PrismaClientKnownRequestError` | Prisma ORM | Mapped by error code (P2002→409, P2025→404, etc.) |
| `Prisma.PrismaClientValidationError` | Prisma ORM | 400 Bad Request |
| Anything else | Unknown | 500 Internal Server Error (detail hidden in production) |

In services, throw NestJS HTTP exceptions directly:
```typescript
throw new NotFoundException('User not found');
throw new ConflictException('Email is already registered');
throw new ForbiddenException('You can only update your own profile');
```

Do not create custom exception classes unless the project genuinely needs business-domain error codes beyond HTTP status codes.

---

## 13. Response Shape

### Success Response

```json
{
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "correlationId": "550e8400-e29b-41d4-a716-446655440000",
    "version": "v1"
  }
}
```

### Paginated Response

```json
{
  "data": {
    "items": [ ... ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  },
  "meta": { ... }
}
```

### Error Response

```json
{
  "statusCode": 400,
  "message": ["email must be an email address"],
  "error": "BAD_REQUEST",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/auth/register"
}
```

To skip the response envelope for a specific endpoint (e.g., a raw file download), decorate the handler with `@SetMetadata(SKIP_TRANSFORM_KEY, true)`.

---

## 14. CI/CD Pipeline

### ci.yml — runs on every PR

```
bun install (cached)
  → prisma generate
  → prisma migrate deploy (against test Postgres container)
  → bun run lint
  → bun run typecheck
  → bun run test:cov         (Pactum API tests; fails below 70% coverage)
  → bun run build
  → upload coverage to Codecov
```

Any step failure blocks the PR merge.

### security.yml — runs on push + weekly cron

```
bun audit                   (known CVE check)
CodeQL analysis             (static security patterns)
TruffleHog secret scan      (detects committed secrets)
```

### Branch Strategy

```
main          ← production; never commit directly; requires passing CI + review
development   ← integration; all feature PRs target this branch
feature/*     ← one feature per branch; named feature/short-description
fix/*         ← bug fix branches; named fix/short-description
```

---

## 15. Key Architectural Decisions

### Why default-deny auth instead of opt-in guards?

The risk of **forgetting to protect a route** (silent security hole) is worse than **forgetting to mark a route public** (visible 401 error caught in development). Default-deny makes the safe path the path of least resistance.

### Why path aliases instead of relative imports?

`@modules/users/users.service` is stable across refactors. `../../users/users.service` breaks every time a file moves. Path aliases also make the import zone membership (`@core`, `@shared`, etc.) visually explicit.

### Why Prisma over TypeORM?

Prisma's generated client is fully typed from the schema. TypeORM's decorator-based entities duplicate the schema in TypeScript and drift from the DB over time. Prisma's migration system is also safer for teams.

### Why nestjs-pino over Winston?

Pino is 5–10× faster than Winston. In high-throughput APIs, logging overhead is measurable. `pino-http` also auto-instruments HTTP requests without manual interceptors.

### Why Zod for config validation instead of class-validator?

Config validation runs once at startup outside of the NestJS DI container, before `ConfigModule` is ready. Zod works as a plain function call — no decorators, no DI, no bootstrap order dependency.

### Why keep DTOs and Entities separate?

An Entity mirrors the database row. A DTO mirrors the API contract. They evolve independently — the DB gains audit columns, the API stays clean. Merging them causes either DB schema leakage into the API or API validation logic inside Prisma models.
