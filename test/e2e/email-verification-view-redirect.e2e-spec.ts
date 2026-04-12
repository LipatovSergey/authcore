import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createTestApp } from '../helpers/test-app.helper';
import { getLastEmailVerificationUrl } from '../mocks/mail-service.mock';

describe('/auth/email-verification (GET) with redirection', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let httpServer: App;
  let restoreEnv: () => void;
  let verificationToken: string;
  const redirectUrl = 'http://localhost:4000/email-verification-result';

  beforeAll(async () => {
    ({ app, dataSource, httpServer, restoreEnv } = await createTestApp({
      EMAIL_VERIFICATION_RESULT_URL: redirectUrl,
    }));
  });

  afterAll(async () => {
    restoreEnv();
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
});
