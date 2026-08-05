export default () => ({
  database: {
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    name: process.env.POSTGRES_DB,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
    emailVerificationSecret: process.env.JWT_EMAIL_VERIFICATION_SECRET,
    emailVerificationExpiresIn: process.env.JWT_EMAIL_VERIFICATION_EXPIRES_IN,
    passwordResetSecret: process.env.JWT_PASSWORD_RESET_SECRET,
    passwordResetExpiresIn: process.env.JWT_PASSWORD_RESET_EXPIRES_IN,
  },

  argon2: {
    memoryCost: Number(process.env.ARGON2_MEMORY_COST),
    timeCost: Number(process.env.ARGON2_TIME_COST),
    parallelism: Number(process.env.ARGON2_PARALLELISM),
  },

  throttler: {
    defaultTtlMs: Number(process.env.THROTTLE_DEFAULT_TTL_MS),
    defaultLimit: Number(process.env.THROTTLE_DEFAULT_LIMIT),

    registerTtlMs: Number(process.env.THROTTLE_AUTH_REGISTER_TTL_MS),
    registerLimit: Number(process.env.THROTTLE_AUTH_REGISTER_LIMIT),

    loginLimit: Number(process.env.THROTTLE_AUTH_LOGIN_LIMIT),
    loginTtlMs: Number(process.env.THROTTLE_AUTH_LOGIN_TTL_MS),

    refreshLimit: Number(process.env.THROTTLE_AUTH_REFRESH_LIMIT),
    refreshTtlMs: Number(process.env.THROTTLE_AUTH_REFRESH_TTL_MS),
  },

  redis: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    db: Number(process.env.REDIS_DB),
  },

  frontendOrigin: process.env.FRONTEND_ORIGIN,
  emailVerificationResultUrl: process.env.EMAIL_VERIFICATION_RESULT_URL,
  passwordResetPageUrl: process.env.PASSWORD_RESET_PAGE_URL,
  authPublicUrl: process.env.AUTH_PUBLIC_URL,

  demoNotificationsOutboxEnabled:
    process.env.ENABLE_DEMO_NOTIFICATIONS_OUTBOX === 'true',

  unverifiedUserTtlMs: Number(process.env.UNVERIFIED_USER_TTL_MS),
  emailVerificationTokenRetentionMs: Number(
    process.env.EMAIL_VERIFICATION_TOKEN_RETENTION_MS,
  ),
  passwordResetTokenRetentionMs: Number(
    process.env.PASSWORD_RESET_TOKEN_RETENTION_MS,
  ),
  refreshTokenRetentionMs: Number(process.env.REFRESH_TOKEN_RETENTION_MS),

  refreshCookieSecure: process.env.REFRESH_COOKIE_SECURE === 'true',
  csrf: {
    signingSecret: process.env.CSRF_SECRET,
  },
});
