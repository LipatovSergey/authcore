import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { createTestApp } from '../helpers/test-app.helper';
import { getLastEmailVerificationUrl } from '../mocks/mail-service.mock';

describe('/auth/email-verification (GET)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let httpServer: App;
  let verificationToken: string;
  let userRepository: Repository<User>;
  const userEmail = 'tester@gmail.com';

  beforeAll(async () => {
    ({ app, dataSource, httpServer } = await createTestApp());
    userRepository = dataSource.getRepository(User);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    await request(httpServer)
      .post('/auth/register')
      .send({
        email: userEmail,
        password: 'some spaced text',
      })
      .expect(201);
    const url = getLastEmailVerificationUrl();
    verificationToken = url.searchParams.get('token') as string;
  });

  it('returns 200 and success page for valid token and marks user as verified', async () => {
    const userBeforeVerification = await userRepository.findOneBy({
      email: userEmail,
    });
    expect(userBeforeVerification?.isEmailVerified).toBe(false);
    expect(userBeforeVerification?.emailVerifiedAt).toBeNull();
    expect(userBeforeVerification?.unverifiedExpiresAt).toBeInstanceOf(Date);
    const res = await request(httpServer).get(
      `/auth/email-verification?token=${verificationToken}`,
    );
    expect(res.statusCode).toBe(200);
    expect(res.type).toContain('html');
    expect(res.text).toContain('Email verified');
    const userAfterVerification = await userRepository.findOneBy({
      email: userEmail,
    });
    expect(userAfterVerification?.isEmailVerified).toBe(true);
    expect(userAfterVerification?.emailVerifiedAt).toBeInstanceOf(Date);
    expect(userAfterVerification?.unverifiedExpiresAt).toBeNull();
  });

  it('returns 200 and failure page when verification token is reused', async () => {
    await request(httpServer)
      .get(`/auth/email-verification?token=${verificationToken}`)
      .expect(200);
    const res = await request(httpServer).get(
      `/auth/email-verification?token=${verificationToken}`,
    );
    expect(res.statusCode).toBe(200);
    expect(res.type).toContain('html');
    expect(res.text).toContain('Verification failed');
  });

  it('returns 200 and failure page if verification token invalid', async () => {
    const res = await request(httpServer).get(
      `/auth/email-verification?token=invalid-token_invalid-token_invalid-token`,
    );
    expect(res.statusCode).toBe(200);
    expect(res.type).toContain('html');
    expect(res.text).toContain('Verification failed');
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
