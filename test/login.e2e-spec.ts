import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/test-app.helper';

describe('/auth/login (POST)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let httpServer: App;

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
  });

  it('returns 200 and auth tokens for valid credentials', async () => {
    const res = await request(httpServer).post('/auth/login').send({
      email: 'tester@gmail.com',
      password: 'some spaced text',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      access_token: expect.any(String),
      refresh_token: expect.any(String),
    });
  });

  it('returns 401 when user does not exist', async () => {
    const res = await request(httpServer).post('/auth/login').send({
      email: 'no-tester@gmail.com',
      password: 'some spaced text',
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('returns 401 when password is invalid', async () => {
    const res = await request(httpServer).post('/auth/login').send({
      email: 'tester@gmail.com',
      password: 'wrong password',
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });
});
