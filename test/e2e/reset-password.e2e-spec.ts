import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createTestApp } from '../helpers/test-app.helper';
import {
  getLastResetPasswordUrl,
  type NotificationsServiceMock,
} from '../mocks/notifications-service.mock';

describe('/auth/reset-password (POST)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let httpServer: App;
  let notificationsServiceMock: NotificationsServiceMock;
  let passwordResetToken: string;
  const endpoint = '/auth/reset-password';
  const userEmail = 'tester@gmail.com';

  beforeAll(async () => {
    ({ app, dataSource, httpServer, notificationsServiceMock } =
      await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    notificationsServiceMock.reset();
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    await request(httpServer)
      .post('/auth/register')
      .send({
        email: userEmail,
        password: 'some spaced text',
      })
      .expect(201);
    await request(httpServer)
      .post('/auth/forgot-password')
      .send({ email: userEmail })
      .expect(200);
    const url = getLastResetPasswordUrl(notificationsServiceMock);
    passwordResetToken = url.searchParams.get('token') as string;
  });

  it('returns 200 with ok message for valid credentials', async () => {
    const res = await request(httpServer).post(endpoint).send({
      token: passwordResetToken,
      password: 'new valid password',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('ok');
  });

  it('returns 400 for invalid password', async () => {
    const res = await request(httpServer).post(endpoint).send({
      token: passwordResetToken,
      password: '123',
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 for invalid token', async () => {
    const res = await request(httpServer).post(endpoint).send({
      token: 'invalid-password-reset-token',
      password: 'new valid password',
    });
    expect(res.statusCode).toBe(401);
  });
});
