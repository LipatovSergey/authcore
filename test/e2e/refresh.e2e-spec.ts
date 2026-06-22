import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource, IsNull, Repository } from 'typeorm';
import { createTestApp } from '../helpers/test-app.helper';
import {
  getLastEmailVerificationUrl,
  type NotificationsServiceMock,
} from '../mocks/notifications-service.mock';
import { RefreshTokensService } from '../../src/auth/tokens/refresh-tokens.service';
import { Session } from '../../src/auth/sessions/session.entity';
import { RefreshToken } from '../../src/auth/entities/refresh-token.entity';
import { User } from '../../src/users/entities/user.entity';

describe('/auth/refresh (POST)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let httpServer: App;
  let notificationsServiceMock: NotificationsServiceMock;
  let refreshToken: string;
  let refreshTokensService: RefreshTokensService;
  let sessionsRepository: Repository<Session>;
  let userRepository: Repository<User>;
  let refreshTokenRepository: Repository<RefreshToken>;
  const userCredentials = {
    email: 'tester@gmail.com',
    password: 'some spaced text',
  };

  beforeAll(async () => {
    ({ app, dataSource, httpServer, notificationsServiceMock } =
      await createTestApp());
    refreshTokensService = app.get(RefreshTokensService);
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
      .send(userCredentials)
      .expect(201);

    const url = getLastEmailVerificationUrl(notificationsServiceMock);
    await request(httpServer).get(`${url.pathname}${url.search}`);

    const loginResponse = await request(httpServer).post('/auth/login').send({
      email: 'tester@gmail.com',
      password: 'some spaced text',
    });
    expect(loginResponse.statusCode).toBe(200);
    refreshToken = loginResponse.body.refresh_token;
  });

  it('returns 200 if credentials are valid', async () => {
    const res = await request(httpServer)
      .post('/auth/refresh')
      .send({ refresh_token: refreshToken });
    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      access_token: expect.any(String),
      refresh_token: expect.any(String),
    });
  });

  it('returns 200 when using the newly issued refresh token after rotation', async () => {
    const response = await request(httpServer).post('/auth/refresh').send({
      refresh_token: refreshToken,
    });
    const newRefreshToken = response.body.refresh_token;
    const res = await request(httpServer).post('/auth/refresh').send({
      refresh_token: newRefreshToken,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      access_token: expect.any(String),
      refresh_token: expect.any(String),
    });
  });

  it('returns 401 if invalid token was passed', async () => {
    const res = await request(httpServer).post('/auth/refresh').send({
      refresh_token: 'invalid token',
    });
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid refresh token');
  });

  it('returns 401 and revokes all user sessions and tokens on refresh token reuse', async () => {
    await request(httpServer)
      .post('/auth/login')
      .send(userCredentials)
      .expect(200);

    await request(httpServer)
      .post('/auth/refresh')
      .send({
        refresh_token: refreshToken,
      })
      .expect(200);

    const res = await request(httpServer).post('/auth/refresh').send({
      refresh_token: refreshToken,
    });
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid refresh token');

    const userEntity = await userRepository.findOneByOrFail({
      email: userCredentials.email,
    });
    const userSessions = await sessionsRepository.find({
      where: { userId: userEntity.id },
    });
    expect(userSessions.length).toBeGreaterThan(0);
    expect(userSessions.every((session) => session.revokedAt !== null)).toBe(
      true,
    );
    const userRefreshTokens = await refreshTokenRepository.find({
      where: { userId: userEntity.id },
    });
    expect(userRefreshTokens.length).toBeGreaterThan(0);
    expect(userRefreshTokens.every((token) => token.revokedAt !== null)).toBe(
      true,
    );
  });

  it('does not revoke another user session and refresh token when reuse is detected', async () => {
    const otherUserCredentials = {
      email: 'tester2@gmail.com',
      password: 'some spaced text',
    };
    await request(httpServer)
      .post('/auth/register')
      .send(otherUserCredentials)
      .expect(201);
    const url = getLastEmailVerificationUrl(notificationsServiceMock);
    await request(httpServer).get(`${url.pathname}${url.search}`);
    await request(httpServer)
      .post('/auth/login')
      .send(otherUserCredentials)
      .expect(200);

    const otherUser = await userRepository.findOneByOrFail({
      email: otherUserCredentials.email,
    });
    const otherSession = await sessionsRepository.findOneByOrFail({
      userId: otherUser.id,
      revokedAt: IsNull(),
    });
    const otherRefreshToken = await refreshTokenRepository.findOneByOrFail({
      userId: otherUser.id,
      sessionId: otherSession.id,
      revokedAt: IsNull(),
    });

    await request(httpServer)
      .post('/auth/refresh')
      .send({ refresh_token: refreshToken })
      .expect(200);
    await request(httpServer)
      .post('/auth/refresh')
      .send({ refresh_token: refreshToken })
      .expect(401);

    const otherSessionAfterReuse = await sessionsRepository.findOneByOrFail({
      id: otherSession.id,
    });
    expect(otherSessionAfterReuse.revokedAt).toBeNull();
    const otherRefreshTokenAfterReuse =
      await refreshTokenRepository.findOneByOrFail({
        id: otherRefreshToken.id,
      });
    expect(otherRefreshTokenAfterReuse.revokedAt).toBeNull();
  });

  it('returns 401 when revoked token reused after logout', async () => {
    await request(httpServer)
      .post('/auth/logout')
      .send({ refresh_token: refreshToken })
      .expect(200);

    const res = await request(httpServer).post('/auth/refresh').send({
      refresh_token: refreshToken,
    });
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid refresh token');
  });

  it('keeps the same session and updates last refreshed time after successful refresh', async () => {
    const initialRefreshToken =
      await refreshTokensService.validateActiveForRotationOrThrow(refreshToken);
    const initialSession = await sessionsRepository.findOneBy({
      id: initialRefreshToken.sessionId,
    });
    expect(initialSession).not.toBeNull();
    expect(initialSession!.lastRefreshedAt).toBeNull();
    const res = await request(httpServer)
      .post('/auth/refresh')
      .send({ refresh_token: refreshToken });
    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      access_token: expect.any(String),
      refresh_token: expect.any(String),
    });
    const rotatedRawRefreshToken = res.body.refresh_token;
    const rotatedRefreshToken =
      await refreshTokensService.validateActiveForRotationOrThrow(
        rotatedRawRefreshToken,
      );
    const refreshedSession = await sessionsRepository.findOneBy({
      id: rotatedRefreshToken.sessionId,
    });
    expect(initialRefreshToken.sessionId).toBe(rotatedRefreshToken.sessionId);
    expect(refreshedSession).not.toBeNull();
    expect(refreshedSession!.lastRefreshedAt).not.toBeNull();
  });

  it('returns 401 when session is revoked', async () => {
    const validatedToken =
      await refreshTokensService.validateActiveForRotationOrThrow(refreshToken);
    const activeSession = await sessionsRepository.findOneBy({
      id: validatedToken.sessionId,
    });
    expect(activeSession).not.toBeNull();
    await sessionsRepository.update(
      { id: activeSession!.id },
      { revokedAt: new Date() },
    );
    const res = await request(httpServer)
      .post('/auth/refresh')
      .send({ refresh_token: refreshToken });
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid refresh token');
  });
});
