# BookLeaf Author Support Portal

Two-sided author support workspace built with React/Tailwind, Express REST, PostgreSQL/Prisma, Redis/BullMQ and Socket.IO in a Turborepo monorepo.

## Run locally

Requirements: Node 20+, pnpm 9+, Docker Desktop.

```sh
cp .env.example .env
docker compose up -d postgres redis
pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

Open http://localhost:5173. Health: http://localhost:4000/api/health. Author demo: `priya.sharma@email.com`; admin demo: `admin@bookleaf.test`; password for both: `bookleaf-demo`. Seed data is `apps/api/prisma/data/sample.json`. Set `OPENAI_API_KEY` in `.env` for model assistance; without it, deterministic classification and policy-based editable drafts are used. Keep API keys out of the frontend.

## Architecture and flow

JWT auth and role checks protect data routes. Author reads are scoped by token subject. PostgreSQL via Prisma stores authors, books, tickets, messages and private notes with foreign keys and queue/ownership indexes. Ticket and initial message are persisted atomically. Dashboard metrics use PostgreSQL `count`, `aggregate` and `groupBy`; Redis briefly caches metrics and mutations invalidate dashboard keys. Search is debounced 280 ms. BullMQ retries AI classification jobs with exponential backoff; JSON values are validated and do not replace admin overrides. Socket.IO rooms are authenticated and ticket ownership is checked. REST remains the source of truth.

AI uses `gpt-4o-mini` with only the current query and compact, relevant policy context, rather than full history and the complete knowledge base. Timeouts, rate limits, malformed responses and missing credentials fall back. Admins edit every draft before sending. Attachments are UI-only, permitted by the assignment.

Sharding is premature at this data size. Scale first with connection pooling, read replicas and time partitioning ticket history. If necessary, route author-scoped ticket/message records by stable author ID hash. Use a warehouse/aggregate store for cross-shard admin reporting and avoid cross-shard transactions.

## API

All routes except health and login require `Authorization: Bearer <token>`.

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/health` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me`, `/api/books`, `/api/dashboard` | Signed in |
| GET | `/api/tickets` (q/status/category/priority/since/page/take) | Signed in |
| GET | `/api/tickets/:id` | Owner/admin |
| POST | `/api/tickets` | Author |
| POST | `/api/tickets/:id/draft` | Admin |
| POST | `/api/tickets/:id/messages` | Owner/admin |
| PATCH | `/api/tickets/:id` | Admin |
| POST | `/api/tickets/:id/notes` | Admin |
| GET | `/api/admin/overview` | Admin |

Statuses: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`. Categories: `ROYALTY`, `ISBN_ISSUES`, `PRINTING`, `DISTRIBUTION`, `PRODUCTION`, `GENERAL`. Priorities: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`.

## Validation and trade-offs

CI runs install, Prisma client generation, lint and build. The web app passed TypeScript lint and a production build; the API passed TypeScript lint and build. Prisma schema generation was validated in engine-free mode, while a regular native-engine copy and a live database integration run were blocked by the host disk limit. Run `pnpm db:generate`, `pnpm db:push`, and `pnpm db:seed` in a Docker-enabled environment before demoing. An illustrative static view is available at `docs/preview.html`. The UI is responsive with dimensional book covers, restrained animation and reduced-motion support.

I prioritised ticket lifecycle and role separation, then added policy-grounded AI assistance and seeded book context. I chose a compact monorepo and a single PostgreSQL writer to keep the system explainable. Production follow-ups: secure object storage, audit trail, SLA timers, email notifications, refresh/session revocation, rate limiting, HTTPS, accessibility review, managed services and secret rotation. Deploy privately; the assignment and dataset are confidential.
