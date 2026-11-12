import { assertEnvironment } from './config/environment.js';
import { prisma } from './config/database.js';
import { startScheduler } from './jobs/scheduler.js';
import { runMonitoringCycle } from './services/monitoring.service.js';
import { log } from './utils/logger.js';
import './utils/bigint.js';

assertEnvironment();
startScheduler();
setTimeout(() => runMonitoringCycle().catch((e) => log.error('initial cycle failed', { message: e.message })), 30_000);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
