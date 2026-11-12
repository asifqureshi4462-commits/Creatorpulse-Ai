import { AppError } from '../utils/errors.js';

/** validate(schema, 'body' | 'query') - replaces the request part with the parsed value. */
export const validate = (schema, part = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[part]);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue.path.join('.');
    return next(new AppError(400, 'VALIDATION_ERROR', `${path ? path + ': ' : ''}${issue.message}`, result.error.issues));
  }
  if (part === 'query') {
    // Express 5 compatibility: query may be read-only
    Object.defineProperty(req, 'validatedQuery', { value: result.data, configurable: true });
  } else {
    req[part] = result.data;
  }
  next();
};
