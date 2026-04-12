import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createTestApp } from '../helpers/test-app.helper';
import { getLastEmailVerificationUrl } from '../mocks/mail-service.mock';

describe('/auth/logout (POST)', () => {
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
    const registerResponse = await request(httpServer)
      .post('/auth/register')
      .send({
        email: 'tester@gmail.com',
        password: 'some spaced text',
      });
    expect(registerResponse.statusCode).toBe(201);

    const url = getLastEmailVerificationUrl();
    await request(httpServer).get(`${url.pathname}${url.search}`);
    const loginResponse = await request(httpServer).post('/auth/login').send({
      email: 'tester@gmail.com',
      password: 'some spaced text',
    });
    expect(loginResponse.statusCode).toBe(200);
    refreshToken = loginResponse.body.refresh_token;
  });

  it('returns 200 if logout succeeds', async () => {
    const res = await request(httpServer).post('/auth/logout').send({
      refresh_token: refreshToken,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('ok');
  });

  it('returns 401 if invalid token was passed', async () => {
    const res = await request(httpServer).post('/auth/logout').send({
      refresh_token: 'invalid refresh token',
    });
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid refresh token');
  });

  it('returns 401 when old refresh token is reused after revoke', async () => {
    await request(httpServer)
      .post('/auth/logout')
      .send({
        refresh_token: refreshToken,
      })
      .expect(200);

    const res = await request(httpServer).post('/auth/logout').send({
      refresh_token: refreshToken,
    });
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid refresh token');
  });
});
