import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource, Not, Repository } from 'typeorm';
import { createTestApp } from '../helpers/test-app.helper';
import {
  getLastEmailVerificationUrl,
  type NotificationsServiceMock,
} from '../mocks/notifications-service.mock';
import { Session } from '../../src/auth/sessions/session.entity';
import { User } from '../../src/users/entities/user.entity';
import { RefreshToken } from '../../src/auth/entities/refresh-token.entity';

describe('/auth/sessions/:id (DELETE)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let httpServer: App;
  let notificationsServiceMock: NotificationsServiceMock;
  let sessionsRepository: Repository<Session>;
  let userRepository: Repository<User>;
  let refreshTokenRepository: Repository<RefreshToken>;
  let primaryAccessToken: string;
  const primaryUserCredentials = {
    email: 'tester@gmail.com',
    password: 'some spaced text',
  };

  beforeAll(async () => {
    ({ app, dataSource, httpServer, notificationsServiceMock } =
      await createTestApp());
    sessionsRepository = dataSource.getRepository(Session);
    userRepository = dataSource.getRepository(User);
    refreshTokenRepository = dataSource.getRepository(RefreshToken);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    notificationsServiceMock.reset();
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    await request(httpServer)
      .post('/auth/register')
      .send(primaryUserCredentials)
      .expect(201);
    const url = getLastEmailVerificationUrl(notificationsServiceMock);
    await request(httpServer).get(`${url.pathname}${url.search}`);
    const loginResponse = await request(httpServer)
      .post('/auth/login')
      .send(primaryUserCredentials);
    expect(loginResponse.statusCode).toBe(200);
    primaryAccessToken = loginResponse.body.access_token;
  });

  it('returns 200 and revokes selected session and its refresh tokens', async () => {
    const userEntity = await userRepository.findOneByOrFail({
      email: primaryUserCredentials.email,
    });
    const primarySession = await sessionsRepository.findOneByOrFail({
      userId: userEntity.id,
    });
    const response = await request(httpServer)
      .delete(`/auth/sessions/${primarySession.id}`)
      .set('Authorization', `Bearer ${primaryAccessToken}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('ok');
    const revokedSessionEntity = await sessionsRepository.findOneByOrFail({
      id: primarySession.id,
    });
    expect(revokedSessionEntity.revokedAt).not.toBeNull();
    const revokedRefreshTokens = await refreshTokenRepository.find({
      where: { sessionId: revokedSessionEntity.id },
    });
    expect(revokedRefreshTokens.length).toBeGreaterThan(0);
    expect(
      revokedRefreshTokens.every((token) => token.revokedAt !== null),
    ).toBe(true);
  });

  it('does not revoke another session of the same user', async () => {
    const userEntity = await userRepository.findOneByOrFail({
      email: primaryUserCredentials.email,
    });
    const primarySession = await sessionsRepository.findOneByOrFail({
      userId: userEntity.id,
    });
    await request(httpServer)
      .post('/auth/login')
      .send(primaryUserCredentials)
      .expect(200);
    const secondSessionBeforeFirstSessionRevoke =
      await sessionsRepository.findOneByOrFail({
        userId: userEntity.id,
        id: Not(primarySession.id),
      });

    await request(httpServer)
      .delete(`/auth/sessions/${primarySession.id}`)
      .set('Authorization', `Bearer ${primaryAccessToken}`)
      .expect(200);
    const secondSessionAfterFirstSessionRevoke =
      await sessionsRepository.findOneByOrFail({
        id: secondSessionBeforeFirstSessionRevoke.id,
      });
    expect(secondSessionAfterFirstSessionRevoke.revokedAt).toBeNull();
  });

  it('returns 401 when trying to revoke another user session', async () => {
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
    const secondUserEntity = await userRepository.findOneByOrFail({
      email: secondUserCredentials.email,
    });
    const secondUserSession = await sessionsRepository.findOneByOrFail({
      userId: secondUserEntity.id,
    });
    await request(httpServer)
      .delete(`/auth/sessions/${secondUserSession.id}`)
      .set('Authorization', `Bearer ${primaryAccessToken}`)
      .expect(401);
    const secondUserSessionAfterRevokeRequest =
      await sessionsRepository.findOneByOrFail({ id: secondUserSession.id });
    expect(secondUserSessionAfterRevokeRequest.revokedAt).toBeNull();
  });

  it('returns 400 when session id is not a UUID', async () => {
    const notUUID = 'not-a-uuid';
    await request(httpServer)
      .delete(`/auth/sessions/${notUUID}`)
      .set('Authorization', `Bearer ${primaryAccessToken}`)
      .expect(400);
  });

  it('returns 401 when current session is revoked', async () => {
    const userEntity = await userRepository.findOneByOrFail({
      email: primaryUserCredentials.email,
    });
    const primarySession = await sessionsRepository.findOneByOrFail({
      userId: userEntity.id,
    });
    const { affected } = await sessionsRepository.update(
      { id: primarySession.id },
      { revokedAt: new Date() },
    );
    expect(affected).toBe(1);
    await request(httpServer)
      .delete(`/auth/sessions/${primarySession.id}`)
      .set('Authorization', `Bearer ${primaryAccessToken}`)
      .expect(401);
  });
});
