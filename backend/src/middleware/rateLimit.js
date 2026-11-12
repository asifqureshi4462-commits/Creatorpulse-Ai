import rateLimit from 'express-rate-limit';

const json = (code, message) => ({ error: { code, message } });

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: json('RATE_LIMITED', 'Too many requests. Please slow down.'),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: json('RATE_LIMITED', 'Too many sign-in attempts. Try again later.'),
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || 'anon',
  message: json('RATE_LIMITED', 'AI requests are limited to 12 per minute. Please wait a moment.'),
});
