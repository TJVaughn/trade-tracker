# @trade-tracker/worker

Node.js TypeScript service that polls SEC EDGAR every 15 minutes for new Form 4,
Form 13F, and Schedule 13D/G filings from tracked entities, stores them in
PostgreSQL, and fires NTFY/email notifications.

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (for Postgres)
- [pnpm](https://pnpm.io/) >= 9.15.0
- Node.js >= 20

---

## Setup

### 1. Start Postgres

From the monorepo root:

```bash
docker compose up -d
```

The container exposes port **5432** with user/password/db all set to `tradetracker`.

### 2. Configure environment variables

Copy the example file and fill in any optional values (SMTP, NTFY):

```bash
cp .env.example .env
```

The only required variable for the worker is:

```
DATABASE_URL=postgresql://tradetracker:tradetracker@localhost:5432/tradetracker
```

Optional but recommended:

| Variable        | Purpose                               | Default           |
|-----------------|---------------------------------------|-------------------|
| `NTFY_BASE_URL` | Base URL for ntfy push notifications  | `https://ntfy.sh` |
| `SMTP_HOST`     | SMTP server for email notifications   | —                 |
| `SMTP_PORT`     | SMTP port (587 = STARTTLS, 465 = SSL) | `587`             |
| `SMTP_USER`     | SMTP username                         | —                 |
| `SMTP_PASS`     | SMTP password / app password          | —                 |
| `SMTP_FROM`     | From address for outgoing mail        | `SMTP_USER`       |

### 3. Install dependencies

From the monorepo root:

```bash
pnpm install
```

### 4. Generate the Prisma client

```bash
pnpm db:generate
# or: cd packages/db && pnpm generate
```

### 5. Run migrations

```bash
pnpm db:migrate
# or: cd packages/db && pnpm migrate:dev
```

This creates all tables in the database.

### 6. Seed tracked entities

```bash
cd packages/db && pnpm seed
```

This inserts the default tracked entities (Nancy Pelosi, Warren Buffett, Palantir,
Elon Musk, Michael Burry). Run it only once (it uses upsert so re-running is safe).

### 7. Start the worker

Development (live-reload with tsx watch):

```bash
cd apps/worker && pnpm dev
# or from root:
pnpm worker
```

Production:

```bash
cd apps/worker && pnpm build && node dist/index.js
```

---

## How it works

1. On startup, `src/index.ts` immediately runs `runPoll()`, then schedules it
   via cron every 15 minutes.
2. `runPoll()` fetches all `tracked=true` entities from the DB and calls
   `pollEntity()` for each one.
3. `pollEntity()` calls the EDGAR Submissions API to get the entity's recent
   filings, filters by form type (Form 4, 13F-HR, SC 13D/G) and a date cutoff,
   and skips accession numbers already in the DB.
4. For each new filing, it fetches the primary document XML/HTML, parses it with
   the appropriate parser, and writes `Filing` + `Transaction` rows to the DB.
5. After persisting, it triggers `notifyNewFiling()`, which queries active
   `Subscription` rows and dispatches NTFY and/or email notifications.
6. `PollerState` tracks the last-checked time per form type so subsequent runs
   only look at truly new filings.

---

## Adding a subscription

Subscriptions are stored in the `Subscription` table. You can insert them
directly via `prisma studio` or a migration seed:

```typescript
await prisma.subscription.create({
  data: {
    type: 'NTFY',
    endpoint: 'my-private-topic',   // the ntfy.sh topic name
    entityId: null,                  // null = notify for ALL entities
    formTypes: [],                   // empty = notify for ALL form types
    active: true,
  },
})
```

For email:

```typescript
await prisma.subscription.create({
  data: {
    type: 'EMAIL',
    endpoint: 'you@example.com',
    entityId: null,
    formTypes: ['FORM_4'],           // only Form 4 alerts
    active: true,
  },
})
```

---

## Rate limiting

The SEC allows up to **10 requests per second**. The worker enforces a minimum
150 ms gap between requests via `EdgarClient.throttle()`. Do not remove this.
