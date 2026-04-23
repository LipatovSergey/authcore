import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createTestApp } from '../helpers/test-app.helper';
import {
  getLastEmailVerificationUrl,
  type MailServiceMock,
} from '../mocks/mail-service.mock';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';

describe('/auth/email-verification/resend (POST)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let httpServer: App;
  let firstEmailVerificatonUrl: URL;
  let userRepository: Repository<User>;
  let mailServiceMock: MailServiceMock;
  const userEmail = 'tester@gmail.com';
  const endpoint = '/auth/email-verification/resend';

  beforeAll(async () => {
    ({ app, dataSource, httpServer, mailServiceMock } = await createTestApp());
    userRepository = dataSource.getRepository(User);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    mailServiceMock.reset();
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    await request(httpServer)
      .post('/auth/register')
      .send({
        email: userEmail,
        password: 'some spaced text',
      })
      .expect(201);
    firstEmailVerificatonUrl = getLastEmailVerificationUrl(mailServiceMock);
  });

  it('returns 200 and sends new verification link, and refreshes unverifiedExpiresAt for unverified user', async () => {
    const userBeforeResend = await userRepository.findOneBy({
      email: userEmail,
    });
    const res = await request(httpServer)
      .post(endpoint)
      .send({ email: userEmail });
    const newEmailVerificationUrl =
      getLastEmailVerificationUrl(mailServiceMock);
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('ok');
    expect(newEmailVerificationUrl.href).not.toBe(
      firstEmailVerificatonUrl.href,
    );
    const userAfterResend = await userRepository.findOneBy({
      email: userEmail,
    });
    const userBeforeResendExpiresAt =
      userBeforeResend?.unverifiedExpiresAt?.getTime() as number;
    const userAfterResendExpiresAt =
      userAfterResend?.unverifiedExpiresAt?.getTime() as number;
    expect(userBeforeResendExpiresAt).toBeLessThan(userAfterResendExpiresAt);
  });

  it('returns 200 and does not send a new verification link for an already verified user', async () => {
    const verificationToken =
      firstEmailVerificatonUrl.searchParams.get('token');
    await request(httpServer).get(
      `/auth/email-verification?token=${verificationToken}`,
    );
    const res = await request(httpServer)
      .post(endpoint)
      .send({ email: userEmail });
    const newEmailVerificationUrl =
      getLastEmailVerificationUrl(mailServiceMock);
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('ok');
    expect(firstEmailVerificatonUrl.href).toBe(newEmailVerificationUrl.href);
  });

  it('returns 200 and does not send a verification link for non-existent user', async () => {
    const res = await request(httpServer)
      .post(endpoint)
      .send({ email: 'non-existent-user@test.com' });
    const newEmailVerificationUrl =
      getLastEmailVerificationUrl(mailServiceMock);
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('ok');
    expect(firstEmailVerificatonUrl.href).toBe(newEmailVerificationUrl.href);
  });

  it('returns 200 with ok message, even if mail sending failed', async () => {
    mailServiceMock.sendEmailVerification.mockRejectedValueOnce(
      new Error('Email verification resend failed'),
    );
    const res = await request(httpServer)
      .post(endpoint)
      .send({ email: userEmail });
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('ok');
  });
});
