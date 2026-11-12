import 'dotenv/config';

const e = process.env;

export const env = {
  nodeEnv: e.NODE_ENV || 'development',
  port: Number(e.PORT || 4000),
  frontendUrl: (e.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, ''),
  databaseUrl: e.DATABASE_URL,
  sessionSecret: e.SESSION_SECRET,
  encryptionSecret: e.ENCRYPTION_SECRET,
  googleClientId: e.GOOGLE_CLIENT_ID,
  googleClientSecret: e.GOOGLE_CLIENT_SECRET,
  googleRedirectUri: e.GOOGLE_REDIRECT_URI,
  androidRedirectUri: e.ANDROID_REDIRECT_URI || 'creatorpulse://auth',
  geminiApiKey: e.GEMINI_API_KEY,
  geminiModel: e.GEMINI_MODEL || 'gemini-2.5-flash',
  aiDailyLimit: Number(e.AI_DAILY_LIMIT || 100),
  enableInlineWorker: e.ENABLE_INLINE_WORKER === 'true',
  monitorWindowDays: Number(e.MONITOR_WINDOW_DAYS || 30),
  monitorMinViews: Number(e.MONITOR_MIN_VIEWS || 30),
};

export const isProd = env.nodeEnv === 'production';

const REQUIRED = {
  DATABASE_URL: env.databaseUrl,
  SESSION_SECRET: env.sessionSecret,
  ENCRYPTION_SECRET: env.encryptionSecret,
  GOOGLE_CLIENT_ID: env.googleClientId,
  GOOGLE_CLIENT_SECRET: env.googleClientSecret,
  GOOGLE_REDIRECT_URI: env.googleRedirectUri,
};

/** Throws a clear error listing every missing or weak setting. */
export function assertEnvironment() {
  const problems = [];
  for (const [name, value] of Object.entries(REQUIRED)) if (!value) problems.push(`${name} is missing`);
  for (const name of ['SESSION_SECRET', 'ENCRYPTION_SECRET']) {
    if (REQUIRED[name] && REQUIRED[name].length < 32) problems.push(`${name} must be at least 32 characters`);
  }
  if (problems.length) {
    throw new Error(`Invalid environment configuration:\n - ${problems.join('\n - ')}\nSee backend/.env.example and docs/INSTALLATION.md`);
  }
}
