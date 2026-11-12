import cron from 'node-cron';
import { runMonitoringCycle } from '../services/monitoring.service.js';
import { log } from '../utils/logger.js';

/** Hourly monitoring (minute 5 of every hour). */
export function startScheduler() {
  cron.schedule('5 * * * *', async () => {
    log.info('monitoring cycle starting');
    const stats = await runMonitoringCycle();
    log.info('monitoring cycle finished', stats);
  });
  log.info('monitoring scheduler started (hourly)');
}
