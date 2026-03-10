import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './helpers/test-app.helper';

describe('/auth/register (POST)', () => {
  let app: INestApplication<App>;
  let httpServer: App;

  beforeAll(async () => {
    ({ app, httpServer } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 when global throttle limit is exceeded', async () => {
    let counter = 0;
    while (counter < 2) {
      counter += 1;
      expect(
        (await request(httpServer).post('/auth/logout')).statusCode,
      ).not.toBe(429);
    }

    const res = await request(httpServer).post('/auth/logout');
    expect(res.statusCode).toBe(429);
  });

  it('returns 429 when register throttle limit is exceeded', async () => {
    let counter = 0;
    while (counter < 5) {
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
    while (counter < 5) {
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
    while (counter < 20) {
      counter += 1;
      expect(
        (await request(httpServer).post('/auth/refresh')).statusCode,
      ).not.toBe(429);
    }

    const res = await request(httpServer).post('/auth/refresh');
    expect(res.statusCode).toBe(429);
  });
});
