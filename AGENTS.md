# AGENTS.md

## Stack
Vite + React (src/), Express (server/), PostgreSQL (pg), bcryptjs, jsonwebtoken.

## Conventions
- Client in `src/`, API calls via `src/api.js` (relative /api URLs only).
- Server: `server/index.js` routes, `server/db.js` pool, `server/quotes.js` countries and Yahoo quote fetching (15s cache).
- Schema changes only via migrations in `db/migrations/`.
- Every user query is filtered by the id from the signed session cookie.

## Run
`npm install`, `npm run dev`, `npm run build`. Env: DATABASE_URL, SESSION_SECRET.

## Decisions
- Python was requested but Node backend was chosen (preview runs Node only).
- Alerts are evaluated server-side when the signed-in client polls `/api/alerts/check` every 20s.
- Stocks are a curated list of 5 per country, plus the country's index.
