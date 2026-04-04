import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/test-app.helper';
import { getLastEmailVerificationUrl } from './mocks/mail-service.mock';

describe('/auth/me (GET)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let httpServer: App;
  let accessToken: string;

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
    const url = getLastEmailVerificationUrl();
    await request(httpServer).get(`${url.pathname}${url.search}`);
    const res = await request(httpServer).post('/auth/login').send({
      email: 'tester@gmail.com',
      password: 'some spaced text',
    });
    accessToken = res.body.access_token;
  });

  it('returns 200 if valid token passed', async () => {
    const res = await request(httpServer)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      id: expect.any(String),
      email: 'tester@gmail.com',
      created_at: expect.any(String),
      updated_at: expect.any(String),
    });
  });

  it('returns 401 when invalid token passed', async () => {
    const res = await request(httpServer)
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('returns 401 when token not passed', async () => {
    const res = await request(httpServer).get('/auth/me');
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });
});
