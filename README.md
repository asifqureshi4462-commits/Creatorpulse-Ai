# CreatorPulse AI

Independent AI-powered YouTube Creator Studio. **Not affiliated with or endorsed by Google or YouTube.**
Developer: Asif Qureshi

Frontend (Vite + Vanilla JS + Tailwind + Chart.js) and backend (Node/Express + Prisma/PostgreSQL) are fully separate. The same REST API is intended to serve a future Java + XML Android app (Retrofit): it uses Bearer tokens, JSON, and `/api/auth/google?platform=android` returns the sign-in code through a deep link (`ANDROID_REDIRECT_URI`).

## Features
Google sign-in with channel verification, dashboard, video manager (search/sort/pagination/edit), analytics (views, watch time, subscribers, traffic, retention, top videos, revenue and demographics when authorized), AI video analyzer (upload, public YouTube URL, transcript), AI titles/descriptions/tags/thumbnail ideas, AI channel strategist with weekly planner and public trend data, comments manager with AI reply drafts (never auto-posted), hourly monitoring worker with AI performance diagnosis, alerts and notification center, settings.

## Honest limitations
- **CTR and impressions are not exposed by the YouTube Analytics API**, so they are never shown or invented. The UI shows average % viewed instead.
- **Liking comments is not supported by the YouTube Data API**, so that action is not offered.
- Revenue and demographics appear only when the account is authorized/eligible.
- AI scores are labelled as AI estimates. Audio/video quality is only commented on when real media was provided.
- Direct upload analysis is limited to 14 MB (Gemini inline limit); use a public YouTube URL or transcript for larger videos.
- Analytics data can lag 24-48 hours.

## Quick start
See `docs/INSTALLATION.md`. Short version:
```bash
npm run install:all
cp backend/.env.example backend/.env      # fill in secrets
cp frontend/.env.example frontend/.env
npm run db:push        # or: npm run db:migrate  (creates migrations)
npm run dev:backend    # terminal 1  (http://localhost:4000)
npm run dev:frontend   # terminal 2  (http://localhost:5173)
```
Docs: `docs/GOOGLE_OAUTH_SETUP.md`, `docs/RENDER_DEPLOYMENT.md`, `docs/API_DOCUMENTATION.md`, `docs/DATABASE.md`.
