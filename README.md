# World Stocks

Stock market data for the US, UK, Japan, Germany, India, Hong Kong, France and Canada. Sign in to keep a watchlist and price alerts.

- Vite + React client, Express API in `server/`, PostgreSQL via `pg`.
- Prices come from Yahoo Finance's public chart endpoint (unofficial, may be delayed or rate-limited).

## Run
Set `DATABASE_URL` and `SESSION_SECRET` (see `.env.example`), then:

    npm install
    npm run dev

Tables are in `db/migrations/`.
