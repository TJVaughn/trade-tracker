# Trade Tracker

A monorepo that tracks SEC EDGAR insider trade filings (Form 4, Form 13F, Schedule 13D/G) for notable entities. It polls EDGAR every 15 minutes and sends notifications via NTFY and email when new filings are detected.

## Monorepo Structure

```
trade-tracker/
├── apps/
│   ├── web/          ← Next.js 15 web dashboard + REST API (port 3000)
│   └── worker/       ← Node.js EDGAR polling service
├── packages/
│   └── db/           ← Prisma schema + PostgreSQL client (shared)
├── docker-compose.yml  ← postgres:16-alpine on port 5432
├── pnpm-workspace.yaml
└── .env.example
```

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+, pnpm 9.x workspaces |
| Web app | Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Recharts |
| Worker | TypeScript, node-cron, fast-xml-parser, axios, nodemailer |
| Database | PostgreSQL 16 via Docker, Prisma 6 ORM |
| Notifications | NTFY (push), Nodemailer (SMTP email) |
| SEC data source | data.sec.gov, efts.sec.gov |

## Setup

### Prerequisites

- Node.js 20+
- pnpm 9.x
- Docker

### Steps

1. Clone the repo.

2. Copy `.env.example` to `.env` and fill in the required values (see [Environment Variables](#environment-variables)).

3. Start PostgreSQL:
   ```bash
   docker compose up -d
   ```

4. Install dependencies from the repo root:
   ```bash
   pnpm install
   ```

5. Run database migrations:
   ```bash
   pnpm db:migrate
   ```

6. Seed pre-configured entities:
   ```bash
   pnpm --filter @trade-tracker/db seed
   ```

7. Start the web app:
   ```bash
   pnpm --filter @trade-tracker/web dev
   ```

8. Start the worker:
   ```bash
   pnpm worker
   ```

The web dashboard is available at `http://localhost:3000`.

## Environment Variables

Copy `.env.example` to `.env` and configure the following:

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `EDGAR_USER_AGENT` | Yes | — | SEC-required header: `"AppName email@domain.com"` |
| `EDGAR_POLL_INTERVAL_MS` | No | `900000` | Polling interval in milliseconds (15 min) |
| `NTFY_BASE_URL` | No | `https://ntfy.sh` | NTFY server base URL |
| `NTFY_TOPIC` | No | — | NTFY topic name for push notifications |
| `SMTP_HOST` | No | — | SMTP server hostname |
| `SMTP_PORT` | No | — | SMTP server port |
| `SMTP_USER` | No | — | SMTP username |
| `SMTP_PASS` | No | — | SMTP password |
| `SMTP_FROM` | No | — | From address for outgoing emails |
| `NEXT_PUBLIC_APP_URL` | No | — | Public URL of the web app |

## Database Models

- **Entity** — tracked person or company (CIK, name, type)
- **Filing** — Form 4 / 13F / 13D-G filing record
- **Transaction** — individual trade or holding from a filing
- **Subscription** — NTFY topic or email address to notify
- **PollerState** — tracks last-checked timestamp per form type

## Pre-seeded Entities

| Name | CIK |
|---|---|
| Nancy Pelosi | 0001649338 |
| Warren Buffett / Berkshire Hathaway | 0000315090 |
| Palantir Technologies | 0001336528 |
| Elon Musk | 0001036176 |
| Michael Burry / Scion Asset Management | 0001718108 |

## Adding a New Entity

Via the web UI: **Entities → Add Entity**

Or via the API:

```bash
curl -X POST http://localhost:3000/api/entities \
  -H "Content-Type: application/json" \
  -d '{"cik": "1318605", "name": "Tesla Inc", "type": "COMPANY"}'
```

CIK numbers can be found at https://www.sec.gov/cgi-bin/browse-edgar.

## Setting Up NTFY Notifications

1. Install the NTFY app on your phone (iOS or Android).
2. Subscribe to a topic (e.g., `my-trade-alerts`).
3. Register the subscription via the web UI or API:

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{"type": "NTFY", "endpoint": "my-trade-alerts"}'
```

## REST API

### Entities

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/entities` | List tracked entities. Query: `tracked`, `search`, `page`, `limit` |
| `POST` | `/api/entities` | Add an entity to track |
| `GET` | `/api/entities/:id` | Entity detail with recent filings |
| `PATCH` | `/api/entities/:id` | Update tracked status, name, or description |
| `DELETE` | `/api/entities/:id` | Remove an entity |

### Filings

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/filings` | List filings. Query: `entityId`, `formType`, `startDate`, `endDate`, `page`, `limit` |
| `GET` | `/api/filings/:id` | Filing detail with all transactions |

### Transactions

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/transactions` | List transactions. Query: `entityId`, `filingId`, `code`, `startDate`, `endDate`, `minValue`, `page`, `limit` |

### Subscriptions

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/subscriptions` | List notification subscriptions |
| `POST` | `/api/subscriptions` | Create a subscription |
| `PATCH` | `/api/subscriptions/:id` | Toggle active status or update form types |
| `DELETE` | `/api/subscriptions/:id` | Remove a subscription |

## SEC EDGAR Compliance

Per SEC guidelines, this app:

- Sends a descriptive `User-Agent` header with a contact email (set via `EDGAR_USER_AGENT`)
- Limits requests to approximately 7 per second (150ms between requests)
- Only fetches filings for explicitly tracked entities — no bulk scraping
