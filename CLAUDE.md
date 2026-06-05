# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# agendaê — Project Context for Claude

Multi-tenant SaaS for service booking (barbershops, esthetic studios, manicure salons). Each tenant gets a public URL where customers book without an account.

Built by a junior dev as portfolio + learning piece. Code quality matters more than feature breadth. Explanations should be paced and pedagogical, in Portuguese (pt-BR).

---

## Tech Stack

- **Runtime**: Next.js 16 (App Router, Turbopack, React Compiler) + React 19
- **Language**: TypeScript 5 strict (`noUncheckedIndexedAccess`, `noImplicitOverride`)
- **Package manager**: pnpm
- **Database**: PostgreSQL 16 (via Docker Compose)
- **ORM**: Prisma 6.19 with `engine: "classic"` in `prisma.config.ts`
- **Testing**: Vitest (unit + integration), `fileParallelism: false`
- **Styling** (future): Tailwind 4 + shadcn/ui
- **Auth** (future): NextAuth v5

---

## Architecture — Clean Architecture + DDD

Layers, dependencies only point inward:

```
src/
├── domain/                # Pure business logic (no Prisma, no Next, no I/O)
│   ├── entities/          # Aggregate roots and entities
│   ├── value-objects/     # Email, Money, TimeSlot, BusinessHours, etc
│   ├── events/            # Domain events
│   ├── errors/            # Typed domain errors
│   ├── repositories/      # Repository interfaces (ports)
│   └── services/          # Domain services (BookingPolicy)
├── application/
│   ├── use-cases/         # One class per system action
│   ├── ports/             # External gateway interfaces (PasswordHasher)
│   ├── repositories/      # In-memory repo implementations (tests)
│   ├── events/            # Event dispatcher
│   └── errors/            # Application-layer errors
├── infrastructure/
│   └── database/prisma/
│       ├── client.ts      # PrismaClient singleton
│       ├── mappers/       # Entity ↔ Row converters
│       └── repositories/  # Prisma repo implementations
├── presentation/          # Components, middlewares (Phase 5, NOT STARTED)
└── shared/utils/          # Result, Entity, ValueObject, UniqueId, DomainEvent
```

### Domain rules — NEVER break

- Domain code **MUST NOT** import from `@prisma/client`, `next/*`, or any infrastructure
- Entities receive Value Objects, not primitives (`Email`, not `string`)
- VOs are immutable, validated on construction, compared by value
- Aggregates emit events via `pullDomainEvents()`; use cases collect them
- Money is **always** in cents (`Int`), never `Decimal` or `Float`
- IDs use ULID (`UniqueId.generate()` → 26-char string)
- All times stored in UTC; timezone translation happens at presentation only

### Use case pattern

```ts
class XUseCase {
  constructor(private repos: ...) {}

  async execute(input): Promise<Result<DomainError | ApplicationError, Output>> {
    // 1. parse/resolve IDs
    // 2. fetch supporting entities
    // 3. validate cross-entity rules (BookingPolicy or directly)
    // 4. mutate/create aggregate
    // 5. persist (deterministic order, future: transaction)
    // 6. return Result with entities + collected domain events
  }
}
```

Use cases return `Result<E, T>` — typed errors as values. They never throw business errors.

---

## Project Status — Phase Tracking

### ✅ Phase 1 — Foundation (COMPLETED)
- ✅ Next.js 15 + TypeScript strict project bootstrap
- ✅ Path aliases per layer (@/domain, @/application, @/infrastructure, @/presentation, @/shared)
- ✅ Folder structure for Clean Arch
- ✅ Docker Compose (Postgres 16 + Adminer)
- ✅ `.env.example` documented
- ✅ Layout without Google Fonts (offline-friendly)
- ✅ Metadata configured (pt-BR, "agendaê" title)

### ✅ Phase 2 — Domain (COMPLETED — ~230 tests passing)

**Value Objects (6):**
- ✅ Email, Duration, TimeSlot, Money, Phone, BusinessHours

**Entities (6):**
- ✅ Tenant, User, Service, Professional, Customer, Booking (Aggregate Root)

**Infrastructure:**
- ✅ Base `Entity`, `ValueObject`, `DomainError`, `BaseDomainEvent`
- ✅ `UniqueId` (ULID branded type)
- ✅ Result/Either pattern
- ✅ `BookingPolicy` (Domain Service for cross-entity rules)
- ✅ 5 Booking events (Created, Cancelled, Rescheduled, Completed, NoShow)
- ✅ ~17 typed domain errors

### ✅ Phase 3 — Application (COMPLETED — ~350+ tests passing)

**Use Cases (11):**
- ✅ CreateService
- ✅ RegisterTenant (creates Tenant + OWNER User + solo Professional if `isSolo`)
- ✅ ListAvailableSlots ⭐ (slot calculation algorithm)
- ✅ CreateBooking ⭐ (with BookingPolicy + cross-tenant guard)
- ✅ CancelBooking (CUSTOMER or OWNER actor)
- ✅ RescheduleBooking (excludes self from conflict check)
- ✅ CreateProfessional (OWNER only)
- ✅ UpdateProfessionalAvailability (OWNER only)
- ✅ CompleteBooking (OWNER or STAFF)
- ✅ MarkAsNoShow (OWNER or STAFF)
- ✅ ListBookings (query, OWNER or STAFF)

**Infrastructure:**
- ✅ All 6 Repository interfaces (Tenant, User, Service, Professional, Customer, Booking) in `domain/repositories/`
- ✅ All 6 In-memory implementations in `application/repositories/in-memory/`
- ✅ `PasswordHasher` port + `FakePasswordHasher` for tests
- ✅ `EventDispatcher` (in-memory, sync, with failure isolation)
- ✅ `RecordingEventHandler` and `FailingEventHandler` for tests
- ✅ `ApplicationError` base class
- ✅ ~10 typed application errors

### 🔄 Phase 4 — Infrastructure (IN PROGRESS — ~50% done)

**4.1 Prisma Setup (✅ COMPLETED)**
- ✅ Prisma 6.19 installed
- ✅ `schema.prisma` with 7 models + enums + indexes
- ✅ `prisma.config.ts` at root with `engine: "classic"` (avoids Prisma 7 adapter complexity)
- ✅ Migration `20260605194702_init` applied
- ✅ Banco principal rodando em localhost:5432

**4.2 Mappers (✅ COMPLETED — round-trip tests passing)**
- ✅ TenantMapper, UserMapper, ServiceMapper, CustomerMapper, BookingMapper
- ✅ ProfessionalMapper (handles `businessHours` JSON + `serviceIds` from join table)
- ✅ `BusinessHours.restore()` added to allow mapper to rebuild from minute-based windows

**4.3 Prisma Repositories (🔄 3 OF 6 DONE)**
- ✅ `PrismaClient` singleton em `src/infrastructure/database/prisma/client.ts`
- ✅ `docker-compose.yml` ganhou service `postgres-test` (porta 5433, `tmpfs` para velocidade)
- ✅ `.env` ganhou `DATABASE_URL_TEST`
- ✅ `cross-env` instalado
- ✅ Scripts `db:migrate:test` e `db:test:up` no `package.json`
- ✅ Helper `tests/integration/helpers/prisma-test.ts` (prismaTest + cleanDatabase + disconnectPrismaTest)
- ✅ `vitest.config.ts` ajustado para `fileParallelism: false` e `maxConcurrency: 1`
- ✅ `PrismaTenantRepository` + integration tests (PASSING ✅)
- ✅ `PrismaUserRepository` + integration tests (8 tests PASSING ✅)
- ✅ `PrismaServiceRepository` + integration tests (7 tests, incl. cross-tenant isolation, PASSING ✅)
- ⏳ `PrismaCustomerRepository` — TODO next
- ⏳ `PrismaProfessionalRepository` — TODO next (most complex: uses `$transaction` for join table sync)
- ⏳ `PrismaBookingRepository` — TODO next

**4.4 Bcrypt PasswordHasher (⏳ NOT STARTED)**
- Will create `BcryptPasswordHasher` implementing `PasswordHasher` port
- Replaces `FakePasswordHasher` in production composition

**4.5 Row-Level Security / RLS (⏳ NOT STARTED) ⭐**
- Enable RLS on all multi-tenant tables
- Policies: "tenant only sees its own rows"
- Set `app.current_tenant` per Prisma session
- Security test: tenant A cannot see tenant B's data

**4.6 Composition Root (⏳ NOT STARTED)**
- Factory that wires use cases with real (Prisma) repos
- Will be used by Server Actions in Phase 5

**4.7 Email handler (⏳ NOT STARTED)**
- `ConsoleEmailHandler` for MVP (logs to stdout)
- Registered on dispatcher to listen to `booking.created`, etc
- Future: swap for Resend in production

### ⏳ Phase 5 — Presentation (NOT STARTED) 🎨

Where the front-end finally appears. Plans:
- shadcn/ui init + custom theme
- Tenant resolution middleware (slug in dev, subdomain in prod)
- NextAuth v5 integration
- Server Actions consuming use cases
- Public pages: landing tenant `/t/[slug]`, signup, login, booking flow
- Owner dashboard: KPIs, calendar, CRUD services, CRUD professionals, business hours editor
- Customer app: my bookings, reschedule/cancel
- React Hook Form + Zod
- Loading/error states + a11y

### ⏳ Phase 6 — Polish (NOT STARTED)

- Prettier + Husky + Commitlint + lint-staged
- GitHub Actions CI
- Multi-stage Dockerfile
- README + Mermaid diagrams
- 4 ADRs from lived experience
- Rate limiting (Upstash Redis)
- Pino structured logging
- Deploy to Vercel + Neon/Supabase

---

## Where We Are RIGHT NOW

**Last commit:** `feat(infra): add Prisma client and TenantRepository with integration tests`

**Next concrete step:** Create the 5 remaining Prisma repositories (User, Service, Customer, Professional, Booking) following the pattern of `PrismaTenantRepository`. Then write integration tests covering each.

**Total tests passing:** ~370+ (unit + integration). Run time: a few seconds.

---

## Common Commands

```bash
# Dev
pnpm dev                                # Next.js dev server
pnpm test                               # Run all tests (unit + integration)
pnpm test:watch                         # Watch mode
pnpm test:ui                            # Vitest UI

# Run a single test file or test by name
pnpm vitest run tests/path/to/file.test.ts   # one file
pnpm vitest run -t "test name substring"      # filter by name (any file)

# Database (dev — port 5432)
docker compose up -d postgres           # Start dev Postgres
pnpm prisma migrate dev --name xxx      # New migration
pnpm prisma studio                      # GUI for the DB

# Database (test — port 5433)
docker compose up -d postgres-test      # Start test Postgres
pnpm db:test:up                         # Start test DB + apply migrations
pnpm db:migrate:test                    # Apply migrations to test DB only

# Quality
pnpm typecheck                          # tsc --noEmit
pnpm lint                               # ESLint
```

---

## Conventions

- **Code in English**, UI/comments user-facing in Portuguese (pt-BR)
- **Conventional Commits**: `feat(scope): ...`, `fix(scope): ...`, `refactor(scope): ...`
- Scopes: `domain`, `application`, `infra`, `presentation`, `shared`, `tests`
- Commits granular per concept; consolidate only when concepts are tightly coupled
- **Never commit `.env`** — only `.env.example`
- File naming: `kebab-case.ts`
- Class naming: `PascalCase`, suffixed by role (`Entity`, `UseCase`, `Repository`, `Mapper`)

---

## Pedagogical Style (for chat assistance)

When helping the user:

1. Explain **why** before showing **how**. Concepts before code.
2. Use Portuguese for explanations, English for code/commits.
3. Show trade-offs explicitly — never hide design decisions.
4. The user is a junior dev. Connect new concepts to ones already mastered.
5. Avoid over-engineering. Pragmatism > purity for MVP. Document the simplification.
6. When refusing a shortcut, explain the cost of the shortcut.
7. Lists files to create before code, so the user can plan.
8. Provides commands ready to copy-paste (PowerShell-friendly on Windows).

---

## Known Decisions (don't second-guess)

- `engine: "classic"` in `prisma.config.ts` — chose stability over Prisma 7 adapter setup
- `fileParallelism: false` in Vitest — DB tests must serialize, can't risk races
- Payment is deferred to v2.0 — schema has `requiresPayment` hook on Service
- Multi-tenancy: shared DB + `tenant_id` on every table + planned RLS as defense in depth
- Solo professional auto-created in RegisterTenant when `isSolo: true`
- BusinessHours stored as JSON column (changes rarely, always read whole)
- Booking state machine: SCHEDULED → CANCELLED/COMPLETED/NO_SHOW (terminal)
- Cancelled bookings DON'T block new bookings in the same slot
- Cross-tenant security checks at use-case layer; RLS to be added at DB level
- Customer email uniqueness enforced at repo, not at entity level
- `Booking.create()` accepts optional `now` for deterministic testing
- All Prisma repos use `upsert` for `save` — covers both insert and update
- Idempotent `delete` (catches `P2025` "not found" silently)

---

## Important Files to Know

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | Database schema (7 models + 6 enums) |
| `prisma.config.ts` | Prisma CLI config (datasource lives here, not in schema) |
| `vitest.config.ts` | Test runner config (serial execution) |
| `docker-compose.yml` | Postgres dev (5432) + test (5433) + Adminer (8080) |
| `src/shared/utils/result.ts` | Result/Either pattern |
| `src/shared/utils/entity.ts` | Base Entity class |
| `src/shared/utils/value-object.ts` | Base ValueObject class |
| `src/shared/utils/id.ts` | UniqueId (branded ULID) |
| `src/domain/services/booking-policy.ts` | Cross-entity booking rules |
| `src/infrastructure/database/prisma/client.ts` | PrismaClient singleton |
| `tests/integration/helpers/prisma-test.ts` | Test DB helpers |
| `CLAUDE.md` | This file |
