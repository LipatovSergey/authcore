import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createTestApp } from '../helpers/test-app.helper';
import {
  getLastEmailVerificationUrl,
  type NotificationsServiceMock,
} from '../mocks/notifications-service.mock';
import { ConfigService } from '@nestjs/config';

describe('/auth/email-verification (GET) with redirection', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let httpServer: App;
  let notificationsServiceMock: NotificationsServiceMock;
  let verificationToken: string;
  let redirectUrl: string;

  beforeAll(async () => {
    ({ app, dataSource, httpServer, notificationsServiceMock } =
      await createTestApp());
    const configService = app.get(ConfigService);
    redirectUrl = configService.getOrThrow<string>(
      'emailVerificationResultUrl',
    );
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
        email: 'tester@gmail.com',
        password: 'some spaced text',
      })
      .expect(201);
    const url = getLastEmailVerificationUrl(notificationsServiceMock);
    verificationToken = url.searchParams.get('token') as string;
  });

  it('returns 302 and redirects with verified status if token is valid', async () => {
    const res = await request(httpServer).get(
      `/auth/email-verification?token=${verificationToken}`,
    );
    expect(res.statusCode).toBe(302);
    const location = new URL(res.headers.location);
    expect(location.searchParams.get('status')).toBe('verified');
    expect(`${location.origin}${location.pathname}`).toBe(redirectUrl);
  });

  it('returns 302 and redirects with invalid status if token is reused', async () => {
    await request(httpServer).get(
      `/auth/email-verification?token=${verificationToken}`,
    );
    const res = await request(httpServer).get(
      `/auth/email-verification?token=${verificationToken}`,
    );
    expect(res.statusCode).toBe(302);
    const location = new URL(res.headers.location);
    expect(location.searchParams.get('status')).toBe('invalid');
    expect(`${location.origin}${location.pathname}`).toBe(redirectUrl);
  });

  it('returns 302 and redirects with invalid status if token is invalid', async () => {
    const res = await request(httpServer).get(
      `/auth/email-verification?token=invalid-token_invalid-token_invalid-token`,
    );
    expect(res.statusCode).toBe(302);
    const location = new URL(res.headers.location);
    expect(location.searchParams.get('status')).toBe('invalid');
    expect(`${location.origin}${location.pathname}`).toBe(redirectUrl);
  });

  it('returns 400 if query input invalid', async () => {
    const res = await request(httpServer).get(
      `/auth/email-verification?token=invalid`,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Bad Request');
  });

  it('returns 401 when login attempted before verification', async () => {
    const res = await request(httpServer).post('/auth/login').send({
      email: 'tester@gmail.com',
      password: 'some spaced text',
    });
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Email is not verified');
  });
});
