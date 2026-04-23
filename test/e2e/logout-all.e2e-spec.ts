import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createTestApp } from '../helpers/test-app.helper';
import {
  getLastEmailVerificationUrl,
  type MailServiceMock,
} from '../mocks/mail-service.mock';

describe('/auth/logout-all (POST)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let httpServer: App;
  let mailServiceMock: MailServiceMock;
  let refreshToken1: string;
  let refreshToken2: string;

  beforeAll(async () => {
    ({ app, dataSource, httpServer, mailServiceMock } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    mailServiceMock.reset();
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    const registerResponse = await request(httpServer)
      .post('/auth/register')
      .send({
        email: 'tester@gmail.com',
        password: 'some spaced text',
      });
    expect(registerResponse.statusCode).toBe(201);

    const url = getLastEmailVerificationUrl(mailServiceMock);
    await request(httpServer).get(`${url.pathname}${url.search}`);
    const loginResponse1 = await request(httpServer).post('/auth/login').send({
      email: 'tester@gmail.com',
      password: 'some spaced text',
    });
    expect(loginResponse1.statusCode).toBe(200);
    refreshToken1 = loginResponse1.body.refresh_token;

    const loginResponse2 = await request(httpServer).post('/auth/login').send({
      email: 'tester@gmail.com',
      password: 'some spaced text',
    });
    expect(loginResponse2.statusCode).toBe(200);
    refreshToken2 = loginResponse2.body.refresh_token;
  });

  it('returns 200 and revokes all user refresh tokens', async () => {
    const res = await request(httpServer).post('/auth/logout-all').send({
      refresh_token: refreshToken2,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('ok');

    await request(httpServer)
      .post('/auth/refresh')
      .send({
        refresh_token: refreshToken2,
      })
      .expect(401);

    await request(httpServer)
      .post('/auth/refresh')
      .send({
        refresh_token: refreshToken1,
      })
      .expect(401);
  });

  it('returns 401 if invalid token was passed', async () => {
    const res = await request(httpServer).post('/auth/logout-all').send({
      refresh_token: 'invalid refresh token',
    });
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid refresh token');
  });
});
