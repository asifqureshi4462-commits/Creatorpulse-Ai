# API

Base: `/api`. JSON in/out. Auth: `Authorization: Bearer <token>`. Errors: `{ "error": { "code", "message" } }`.

| Method | Path | Notes |
|---|---|---|
| GET | /health | liveness |
| GET | /auth/google?platform=web\|android | redirect to Google |
| GET | /auth/callback | Google redirect target; redirects to `FRONTEND_URL/#/auth/callback?code=` |
| POST | /auth/exchange `{code}` | one-time code -> `{token}` (7 days) |
| POST | /auth/logout | audit only; client discards token |
| GET | /auth/me | user, channel, settings, permissions |
| GET | /channel/profile, /channel/statistics | stored profile / live totals |
| GET | /videos?q&sort&status&page&pageSize&refresh | synced to DB, search/sort/pagination |
| POST | /videos/sync | force sync |
| GET | /videos/:id | video, alerts, monitor snapshots |
| GET | /videos/:id/analytics | metrics, traffic, retention (each `available` true/false) |
| PUT | /videos/:id/metadata `{title?,description?,tags?}` | updates on YouTube |
| GET | /comments?q&filter=all\|unanswered&pageToken | |
| POST | /comments/:id/reply `{text}` | explicit user action |
| GET | /analytics/overview?days=7\|28\|90\|365 | each section optional |
| GET | /analytics/history | recorded channel snapshots |
| POST | /ai/analyze-video | multipart: `video` file or `youtubeUrl`/`videoId`/`transcript` |
| POST | /ai/generate-title, generate-description, generate-tags, thumbnail-suggestions | `{videoId?|topic, context?}` |
| POST | /ai/reply-suggestions | `{commentText, videoTitle?}` |
| POST | /ai/channel-strategy | |
| GET | /ai/recommendations/latest, /ai/status | |
| GET | /alerts | |
| GET | /notifications, /notifications/unread-count, /notifications/jobs | |
| POST | /notifications/:id/read, /notifications/read-all | |
| GET/PUT | /settings | |
| DELETE | /settings/account | revoke Google access and delete data |

Rate limits: 600 requests / 15 min per IP; 12 AI requests / minute per user; daily AI cap `AI_DAILY_LIMIT`.
