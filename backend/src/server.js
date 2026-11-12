import { assertEnvironment, env } from './config/environment.js';
import { prisma } from './config/database.js';
import app from './app.js';
import { startScheduler } from './jobs/scheduler.js';
import { log } from './utils/logger.js';

assertEnvironment();

const server = app.listen(env.port, () => {
  log.info(`CreatorPulse AI API listening on :${env.port}`, { gemini: Boolean(env.geminiApiKey) });
  if (env.enableInlineWorker) startScheduler();
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
