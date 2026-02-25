import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/test-app.helper';

describe('/auth/refresh (POST)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let httpServer: App;
  let refreshToken: string;

  beforeAll(async () => {
    ({ app, dataSource, httpServer } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    await request(httpServer)
      .post('/auth/register')
      .send({
        email: 'tester@gmail.com',
        password: 'some spaced text',
      })
      .expect(201);
    const loginResponse = await request(httpServer).post('/auth/login').send({
      email: 'tester@gmail.com',
      password: 'some spaced text',
    });
    expect(loginResponse.statusCode).toBe(200);
    refreshToken = loginResponse.body.refresh_token;
  });

  it('returns 200 if credentials are valid', async () => {
    const res = await request(httpServer)
      .post('/auth/refresh')
      .send({ refresh_token: refreshToken });
    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      access_token: expect.any(String),
      refresh_token: expect.any(String),
    });
  });

  it('returns 401 if invalid token was passed', async () => {
    const res = await request(httpServer).post('/auth/refresh').send({
      refresh_token: 'invalid-refresh-token',
    });
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid refresh token');
  });
});
