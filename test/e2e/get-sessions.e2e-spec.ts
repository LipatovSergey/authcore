import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { createTestApp } from '../helpers/test-app.helper';
import {
  getLastEmailVerificationUrl,
  type NotificationsServiceMock,
} from '../mocks/notifications-service.mock';
import { Session } from '../../src/auth/sessions/session.entity';
import { User } from '../../src/users/entities/user.entity';

describe('/auth/sessions (GET)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let httpServer: App;
  let notificationsServiceMock: NotificationsServiceMock;
  let sessionsRepository: Repository<Session>;
  let userRepository: Repository<User>;
  let primaryAccessToken: string;
  const userCredentials = {
    email: 'tester@gmail.com',
    password: 'some spaced text',
  };

  beforeAll(async () => {
    ({ app, dataSource, httpServer, notificationsServiceMock } =
      await createTestApp());
    sessionsRepository = dataSource.getRepository(Session);
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
      .send(userCredentials)
      .expect(201);
    const url = getLastEmailVerificationUrl(notificationsServiceMock);
    await request(httpServer).get(`${url.pathname}${url.search}`);
    const loginResponse = await request(httpServer)
      .post('/auth/login')
      .send(userCredentials);
    expect(loginResponse.statusCode).toBe(200);
    primaryAccessToken = loginResponse.body.access_token;
  });

  it('returns 200 with active sessions for current user', async () => {
    const response = await request(httpServer)
      .get('/auth/sessions')
      .set('Authorization', `Bearer ${primaryAccessToken}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.sessions).toEqual(expect.any(Array));
    expect(response.body.sessions).toHaveLength(1);
    expect(response.body.sessions[0]).toStrictEqual({
      id: expect.any(String),
      user_agent: null,
      ip_address: null,
      created_at: expect.any(String),
      last_refreshed_at: null,
    });
  });

  it('does not return sessions belonging to another user', async () => {
    const secondUserCredentials = {
      email: 'tester-2@gmail.com',
      password: 'some spaced text',
    };
    await request(httpServer)
      .post('/auth/register')
      .send(secondUserCredentials)
      .expect(201);
    const url = getLastEmailVerificationUrl(notificationsServiceMock);
    await request(httpServer).get(`${url.pathname}${url.search}`);
    await request(httpServer)
      .post('/auth/login')
      .send(secondUserCredentials)
      .expect(200);
    const otherUser = await userRepository.findOneByOrFail({
      email: secondUserCredentials.email,
    });
    const otherUserSessions = await sessionsRepository.find({
      where: { userId: otherUser.id },
    });
    expect(otherUserSessions).toHaveLength(1);

    const response = await request(httpServer)
      .get('/auth/sessions')
      .set('Authorization', `Bearer ${primaryAccessToken}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.sessions).toEqual(expect.any(Array));
    const responseBody = response.body as { sessions: Array<{ id: string }> };
    expect(responseBody.sessions).toHaveLength(1);
    const currentUserSessionIds = responseBody.sessions.map(
      (session) => session.id,
    );
    expect(currentUserSessionIds).not.toContain(otherUserSessions[0].id);
  });

  it('returns 401 when current session is revoked', async () => {
    const initialResponse = await request(httpServer)
      .get('/auth/sessions')
      .set('Authorization', `Bearer ${primaryAccessToken}`);
    expect(initialResponse.statusCode).toBe(200);
    expect(initialResponse.body.sessions).toEqual(expect.any(Array));
    expect(initialResponse.body.sessions).toHaveLength(1);
    const currentSessionId = initialResponse.body.sessions[0].id;
    const { affected } = await sessionsRepository.update(
      { id: currentSessionId },
      { revokedAt: new Date() },
    );
    expect(affected).toBe(1);
    const responseAfterSessionRevoke = await request(httpServer)
      .get('/auth/sessions')
      .set('Authorization', `Bearer ${primaryAccessToken}`);
    expect(responseAfterSessionRevoke.statusCode).toBe(401);
  });

  it('does not return revoked sessions', async () => {
    const initialResponse = await request(httpServer)
      .get('/auth/sessions')
      .set('Authorization', `Bearer ${primaryAccessToken}`);
    expect(initialResponse.statusCode).toBe(200);
    expect(initialResponse.body.sessions).toHaveLength(1);
    const sessionToRevokeId = initialResponse.body.sessions[0].id;
    const secondLoginResponse = await request(httpServer)
      .post('/auth/login')
      .send(userCredentials)
      .expect(200);
    const secondAccessToken = secondLoginResponse.body.access_token;
    const responseBeforeRevoke = await request(httpServer)
      .get('/auth/sessions')
      .set('Authorization', `Bearer ${secondAccessToken}`);
    expect(responseBeforeRevoke.statusCode).toBe(200);
    expect(responseBeforeRevoke.body.sessions).toHaveLength(2);
    const { affected } = await sessionsRepository.update(
      { id: sessionToRevokeId },
      { revokedAt: new Date() },
    );
    expect(affected).toBe(1);
    const responseAfterSessionRevoke = await request(httpServer)
      .get('/auth/sessions')
      .set('Authorization', `Bearer ${secondAccessToken}`);
    expect(responseAfterSessionRevoke.statusCode).toBe(200);
    expect(responseAfterSessionRevoke.body.sessions).toHaveLength(1);
    const responseBody = responseAfterSessionRevoke.body as {
      sessions: Array<{ id: string }>;
    };
    expect(responseBody.sessions[0].id).not.toBe(sessionToRevokeId);
  });
});
