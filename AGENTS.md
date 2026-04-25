# MiniMax Proxy - Agent Notes

## Dev Commands

```bash
# Backend (port 3000)
cd backend && npm install && npm run dev

# Frontend (port 3001, proxies /api to backend)
cd frontend && npm install && npm run dev
```

## Architecture

- **Backend**: Node.js Express, auto-creates DB + admin user on first startup via `init.sql`
- **Frontend**: React Vite, proxies `/api` and `/v1` to backend in dev mode
- **Sessions**: Stored in `data/sessions.db` (SQLite)
- **Rate limiting**: In-memory, resets on restart (not distributed)

## Proxy Flow

```
POST /v1/chat/completions  →  /v1/text/chatcompletion_v2 (MiniMax non-standard endpoint)
```
Request body uses standard OpenAI format; proxy converts to MiniMax format.

## Key Quirks

- API keys stored as SHA-256 hash (only prefix `sk_minimax_xxx` shown to user)
- `quota_used` counts requests, not tokens
- `quota_limit` and `expires_at` are per-key, not per-user
- `MASTER_KEY` (32+ chars) encrypts MiniMax API key with AES-256-GCM; stored value prefixed with `enc:`

## Required Env Vars

| Variable | Notes |
|----------|-------|
| `SESSION_SECRET` | 32+ chars |
| `ADMIN_PASSWORD` | Initial admin password |
| `MINIMAX_API_KEY` | Or `ENCRYPTED_MINIMAX_KEY` (prefix `enc:`) |
| `MASTER_KEY` | 32+ chars, encrypts MiniMax key |
| `DB_DIR` | Backend only: where SQLite files go (default: `./data`) |

## Default Credentials

- Username: `admin`
- Password: `admin123` (change immediately after first login)

## Docker

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Rebuild
docker-compose up -d --build
```

## No Test Suite

No `test` scripts in package.json. Manual testing via Docker or `npm run dev`.
