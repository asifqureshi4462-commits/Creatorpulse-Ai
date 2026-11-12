# Installation

Requirements: Node.js 20+, PostgreSQL 14+, a Google Cloud project (see GOOGLE_OAUTH_SETUP.md), optionally a Gemini API key.

1. `npm run install:all`
2. Create a database: `createdb creatorpulse`
3. `cp backend/.env.example backend/.env` and set:
   - `DATABASE_URL`
   - `SESSION_SECRET`, `ENCRYPTION_SECRET` - generate each: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` (min 32 chars)
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/callback`
   - `GEMINI_API_KEY` (AI features show a clear "not configured" message without it)
4. `cp frontend/.env.example frontend/.env` (leave `VITE_API_URL` empty locally; Vite proxies `/api`).
5. Database: `npm run db:migrate -- --name init` creates and applies a migration under `backend/prisma/migrations` (commit it). For a quick start without migration files use `npm run db:push`.
6. Run `npm run dev:backend` and `npm run dev:frontend`, open http://localhost:5173.
7. Monitoring: set `ENABLE_INLINE_WORKER=true` for the API process to run the hourly job, or run `npm run dev:worker` separately.

While your OAuth consent screen is in "Testing", add your Google account as a test user.
