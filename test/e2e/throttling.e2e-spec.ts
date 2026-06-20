import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from '../helpers/test-app.helper';

const DEFAULT_THROTTLE_LIMIT = 2;
const DEFAULT_THROTTLE_TTL_MS = 1000;
const AUTH_ENDPOINT_DEFAULT_THROTTLE_LIMIT = 100;
const AUTH_ENDPOINT_DEFAULT_THROTTLE_TTL_MS = 1000;
const REGISTER_THROTTLE_LIMIT = 3;
const REGISTER_THROTTLE_TTL_MS = 1000;
const LOGIN_THROTTLE_LIMIT = 4;
const LOGIN_THROTTLE_TTL_MS = 1000;
const REFRESH_THROTTLE_LIMIT = 5;
const REFRESH_THROTTLE_TTL_MS = 1000;

// Throttler storage lives for the whole Nest app instance. The default throttler
// test uses a very small limit, so it must not share storage with endpoint tests.
describe('default throttling', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let restoreEnv: () => void;

  beforeAll(async () => {
    ({ app, httpServer, restoreEnv } = await createTestApp({
      THROTTLE_DEFAULT_LIMIT: String(DEFAULT_THROTTLE_LIMIT),
      THROTTLE_DEFAULT_TTL_MS: String(DEFAULT_THROTTLE_TTL_MS),
    }));
  });

  afterAll(async () => {
    restoreEnv();
    await app.close();
  });

  it('returns 429 when global throttle limit is exceeded', async () => {
    let counter = 0;
    while (counter < DEFAULT_THROTTLE_LIMIT) {
      counter += 1;
      expect(
        (await request(httpServer).post('/auth/logout')).statusCode,
      ).not.toBe(429);
    }

    const res = await request(httpServer).post('/auth/logout');
    expect(res.statusCode).toBe(429);
  });
});

describe('auth endpoint throttling', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let restoreEnv: () => void;

  beforeAll(async () => {
    ({ app, httpServer, restoreEnv } = await createTestApp({
      THROTTLE_DEFAULT_LIMIT: String(AUTH_ENDPOINT_DEFAULT_THROTTLE_LIMIT),
      THROTTLE_DEFAULT_TTL_MS: String(AUTH_ENDPOINT_DEFAULT_THROTTLE_TTL_MS),
      THROTTLE_AUTH_REGISTER_LIMIT: String(REGISTER_THROTTLE_LIMIT),
      THROTTLE_AUTH_REGISTER_TTL_MS: String(REGISTER_THROTTLE_TTL_MS),
      THROTTLE_AUTH_LOGIN_LIMIT: String(LOGIN_THROTTLE_LIMIT),
      THROTTLE_AUTH_LOGIN_TTL_MS: String(LOGIN_THROTTLE_TTL_MS),
      THROTTLE_AUTH_REFRESH_LIMIT: String(REFRESH_THROTTLE_LIMIT),
      THROTTLE_AUTH_REFRESH_TTL_MS: String(REFRESH_THROTTLE_TTL_MS),
    }));
  });

  afterAll(async () => {
    restoreEnv();
    await app.close();
  });

  it('returns 429 when register throttle limit is exceeded', async () => {
    let counter = 0;
    while (counter < REGISTER_THROTTLE_LIMIT) {
      counter += 1;
      expect(
        (await request(httpServer).post('/auth/register')).statusCode,
      ).not.toBe(429);
    }

    const res = await request(httpServer).post('/auth/register');
    expect(res.statusCode).toBe(429);
  });

  it('returns 429 when login throttle limit is exceeded', async () => {
    let counter = 0;
    while (counter < LOGIN_THROTTLE_LIMIT) {
      counter += 1;
      expect(
        (await request(httpServer).post('/auth/login')).statusCode,
      ).not.toBe(429);
    }

    const res = await request(httpServer).post('/auth/login');
    expect(res.statusCode).toBe(429);
  });

  it('returns 429 when refresh throttle limit is exceeded', async () => {
    let counter = 0;
    while (counter < REFRESH_THROTTLE_LIMIT) {
      counter += 1;
      expect(
        (await request(httpServer).post('/auth/refresh')).statusCode,
      ).not.toBe(429);
    }

    const res = await request(httpServer).post('/auth/refresh');
    expect(res.statusCode).toBe(429);
  });
});
