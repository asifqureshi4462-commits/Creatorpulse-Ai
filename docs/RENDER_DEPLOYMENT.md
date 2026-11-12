# Render deployment

Push the repository to GitHub, then either use the Blueprint (`render.yaml`) or create services manually.

1. **PostgreSQL**: New > PostgreSQL. Copy the *Internal Database URL*.
2. **Backend Web Service** (root directory `backend`)
   - Build: `npm install && npx prisma generate && npx prisma migrate deploy || npx prisma db push`
     (uses migrations if you committed them, otherwise pushes the schema)
   - Start: `npm start`, health check `/api/health`
   - Environment variables (all secrets live only here): `NODE_ENV=production`, `DATABASE_URL`, `FRONTEND_URL` (the static site URL, no trailing slash), `GOOGLE_REDIRECT_URI` (`https://YOUR-API.onrender.com/api/auth/callback`), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `ENCRYPTION_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `ENABLE_INLINE_WORKER=true`
3. **Static Site** (root directory `frontend`): build `npm install && npm run build`, publish `dist`, env `VITE_API_URL=https://YOUR-API.onrender.com`.
   Add no rewrite rules: the app uses hash routing.
4. **Background Worker** (optional, paid): root `backend`, start `npm run worker`, same env vars; set `ENABLE_INLINE_WORKER=false` on the API so jobs do not run twice.
5. Add the production redirect URI in Google Cloud Console (see GOOGLE_OAUTH_SETUP.md).
6. Run only one API instance: one-time sign-in codes are held in memory.
