import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { createTestApp } from '../helpers/test-app.helper';
import type { NotificationsServiceMock } from '../mocks/notifications-service.mock';

describe('/auth/email-verification (GET)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let httpServer: App;
  let userRepository: Repository<User>;
  let notificationsServiceMock: NotificationsServiceMock;
  const userEmail = 'tester@gmail.com';
  const endpoint = '/auth/forgot-password';

  beforeAll(async () => {
    ({ app, dataSource, httpServer, notificationsServiceMock } =
      await createTestApp());
    userRepository = dataSource.getRepository(User);
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
  });

  it('returns 200 with ok message for existing user', async () => {
    const res = await request(httpServer)
      .post(endpoint)
      .send({ email: userEmail });
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('ok');
  });

  it('returns 200 with ok message for existing user', async () => {
    const res = await request(httpServer)
      .post(endpoint)
      .send({ email: 'not-existing-user@email.com' });
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('ok');
  });

  it('returns 400 if email is invalid', async () => {
    const res = await request(httpServer)
      .post(endpoint)
      .send({ email: 'invalid email' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Bad Request');
  });

  it('returns 200 with ok message, even if mail sending failed', async () => {
    notificationsServiceMock.sendPasswordReset.mockRejectedValueOnce(
      new Error('Password reset email failed'),
    );
    const res = await request(httpServer)
      .post(endpoint)
      .send({ email: userEmail });
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('ok');
  });
});
