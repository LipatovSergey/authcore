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
  },

  argon2: {
    memoryCost: Number(process.env.ARGON2_MEMORY_COST),
    timeCost: Number(process.env.ARGON2_TIME_COST),
    parallelism: Number(process.env.ARGON2_PARALLELISM),
  },

  throttle: {
    global: {
      limit: Number(process.env.THROTTLE_GLOBAL_LIMIT),
      ttlMs: Number(process.env.THROTTLE_GLOBAL_TTL_MS),
    },
    login: {
      limit: Number(process.env.THROTTLE_LOGIN_LIMIT),
      ttlMs: Number(process.env.THROTTLE_LOGIN_TTL_MS),
    },
    register: {
      limit: Number(process.env.THROTTLE_REGISTER_LIMIT),
      ttlMs: Number(process.env.THROTTLE_REGISTER_TTL_MS),
    },
    refresh: {
      limit: Number(process.env.THROTTLE_REFRESH_LIMIT),
      ttlMs: Number(process.env.THROTTLE_REFRESH_TTL_MS),
    },
  },
});
