export const googleReason = (e) => e?.response?.data?.error?.errors?.[0]?.reason || e?.errors?.[0]?.reason;

export const isQuotaError = (e) =>
  ['quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded', 'userRateLimitExceeded'].includes(googleReason(e));

export const isAuthError = (e) => {
  const msg = String(e?.message || '');
  return (
    e?.response?.data?.error === 'invalid_grant' ||
    msg.includes('invalid_grant') ||
    e?.code === 401 ||
    e?.status === 401 ||
    e?.response?.status === 401
  );
};

export const isPermissionError = (e) =>
  googleReason(e) === 'insufficientPermissions' || /insufficient (authentication )?scopes?|insufficient permission/i.test(String(e?.message || ''));

export const isNotFoundError = (e) => e?.code === 404 || e?.response?.status === 404;

export const googleMessage = (e) => e?.response?.data?.error?.message || e?.message || 'Google API error';
