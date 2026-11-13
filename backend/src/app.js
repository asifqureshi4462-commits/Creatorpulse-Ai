import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/environment.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFound } from './middleware/error.js';
import routes from './routes/index.js';
import { log } from './utils/logger.js';
import './utils/bigint.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    // https://localhost / capacitor://localhost are the origins of the Android (Capacitor) app
    origin: [env.frontendUrl, 'http://localhost:5173', 'https://localhost', 'capacitor://localhost'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path !== '/api/health') log.info('request', { method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start });
  });
  next();
});
app.use('/api', apiLimiter, routes);
app.use(notFound);
app.use(errorHandler);

export default app;
