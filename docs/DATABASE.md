# Database

PostgreSQL via Prisma (`backend/prisma/schema.prisma`). Tables: users, connected_channels, oauth_tokens (AES-256-GCM encrypted), videos, video_analytics, channel_analytics, comments, ai_analyses, ai_recommendations, performance_alerts, notifications, scheduled_jobs, user_settings, audit_logs.

Every user-owned row is reachable only through `users` with cascading foreign keys; all queries are scoped by the authenticated user's channel. Indexes cover user/channel + time lookups.

Migrations: `cd backend && npx prisma migrate dev --name init` (creates `prisma/migrations`), deploy with `npx prisma migrate deploy`. `npx prisma db push` syncs the schema without migration files.
