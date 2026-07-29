import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource, IsNull, Repository } from 'typeorm';
import { createTestApp } from '../helpers/test-app.helper';
import {
  getLastEmailVerificationUrl,
  type NotificationsServiceMock,
} from '../mocks/notifications-service.mock';
import { Session } from '../../src/auth/sessions/session.entity';
import { RefreshToken } from '../../src/auth/entities/refresh-token.entity';
import { User } from '../../src/users/entities/user.entity';
import { JwtTokensService } from '../../src/auth/tokens/jwt-tokens.service';
import { getRefreshTokenFromCookie } from '../helpers/set-cookie-test.helper';

describe('/auth/refresh (POST)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let httpServer: App;
  let notificationsServiceMock: NotificationsServiceMock;
  let refreshToken: string;
  let agent: ReturnType<typeof request.agent>;
  let jwtTokensService: JwtTokensService;
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
    jwtTokensService = app.get(JwtTokensService);
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

    agent = request.agent(httpServer);
    const loginResponse = await agent.post('/auth/login').send({
      email: 'tester@gmail.com',
      password: 'some spaced text',
    });
    expect(loginResponse.statusCode).toBe(200);
    refreshToken = getRefreshTokenFromCookie(
      loginResponse.headers['set-cookie'],
    );
  });

  describe('cookie-only transport', () => {
    it('returns 200 and an access token when the refresh cookie is valid', async () => {
      const res = await agent.post('/auth/refresh');

      expect(res.statusCode).toBe(200);
      expect(res.body).toStrictEqual({
        access_token: expect.any(String),
      });
    });

    it('replaces the cookie after refresh token rotation', async () => {
      const firstRefresh = await agent.post('/auth/refresh').expect(200);
      const secondRefresh = await agent.post('/auth/refresh').expect(200);
      const firstRotatedToken = getRefreshTokenFromCookie(
        firstRefresh.headers['set-cookie'],
      );
      const secondRotatedToken = getRefreshTokenFromCookie(
        secondRefresh.headers['set-cookie'],
      );

      expect(firstRefresh.body).toStrictEqual({
        access_token: expect.any(String),
      });
      expect(secondRefresh.body).toStrictEqual({
        access_token: expect.any(String),
      });
      expect(firstRotatedToken).not.toBe(refreshToken);
      expect(secondRotatedToken).not.toBe(firstRotatedToken);
    });

    it('does not authenticate with a refresh token from the request body', async () => {
      const res = await request(httpServer)
        .post('/auth/refresh')
        .send({ refresh_token: refreshToken });

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Refresh credentials are required');
    });

    it('returns 401 when refresh credentials are missing', async () => {
      const res = await request(httpServer).post('/auth/refresh');

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Refresh credentials are required');
    });

    it('returns 401 when refresh cookie is empty', async () => {
      const res = await request(httpServer)
        .post('/auth/refresh')
        .set('Cookie', 'refresh_token=');

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Invalid refresh credentials');
    });

    it('returns 401 when the refresh cookie is invalid', async () => {
      const res = await request(httpServer)
        .post('/auth/refresh')
        .set('Cookie', 'refresh_token=invalid');

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Invalid refresh token');
    });
  });

  describe('rotation and session behavior', () => {
    it('returns 401 and revokes all user sessions and tokens on refresh token reuse', async () => {
      await request(httpServer)
        .post('/auth/login')
        .send(userCredentials)
        .expect(200);

      await request(httpServer)
        .post('/auth/refresh')
        .set('Cookie', `refresh_token=${refreshToken}`)
        .expect(200);

      const res = await request(httpServer)
        .post('/auth/refresh')
        .set('Cookie', `refresh_token=${refreshToken}`);
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
        .set('Cookie', `refresh_token=${refreshToken}`)
        .expect(200);
      await request(httpServer)
        .post('/auth/refresh')
        .set('Cookie', `refresh_token=${refreshToken}`)
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
        .set('Cookie', `refresh_token=${refreshToken}`)
        .expect(200);

      const res = await request(httpServer)
        .post('/auth/refresh')
        .set('Cookie', `refresh_token=${refreshToken}`);
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Invalid refresh token');
    });

    it('keeps the same session and updates last refreshed time after successful refresh', async () => {
      const initialPayload =
        await jwtTokensService.verifyRefreshToken(refreshToken);
      const initialRefreshToken = await refreshTokenRepository.findOneByOrFail({
        jti: initialPayload.jti,
      });
      const initialSession = await sessionsRepository.findOneByOrFail({
        id: initialPayload.sid,
      });

      expect(initialRefreshToken.revokedAt).toBeNull();
      expect(initialRefreshToken.sessionId).toBe(initialPayload.sid);
      expect(initialSession.lastRefreshedAt).toBeNull();

      const res = await agent.post('/auth/refresh');

      expect(res.statusCode).toBe(200);
      expect(res.body).toStrictEqual({
        access_token: expect.any(String),
      });

      const rotatedRawRefreshToken = getRefreshTokenFromCookie(
        res.headers['set-cookie'],
      );
      const rotatedPayload = await jwtTokensService.verifyRefreshToken(
        rotatedRawRefreshToken,
      );
      const initialRefreshTokenAfterRotation =
        await refreshTokenRepository.findOneByOrFail({
          id: initialRefreshToken.id,
        });
      const rotatedRefreshToken = await refreshTokenRepository.findOneByOrFail({
        jti: rotatedPayload.jti,
      });
      const refreshedSession = await sessionsRepository.findOneByOrFail({
        id: rotatedPayload.sid,
      });

      expect(rotatedPayload.sub).toBe(initialPayload.sub);
      expect(rotatedPayload.sid).toBe(initialPayload.sid);
      expect(rotatedPayload.jti).not.toBe(initialPayload.jti);
      expect(initialRefreshTokenAfterRotation.revokedAt).not.toBeNull();
      expect(rotatedRefreshToken.revokedAt).toBeNull();
      expect(rotatedRefreshToken.sessionId).toBe(rotatedPayload.sid);
      expect(refreshedSession.id).toBe(rotatedPayload.sid);
      expect(refreshedSession.revokedAt).toBeNull();
      expect(refreshedSession.lastRefreshedAt).not.toBeNull();
    });

    it('returns 401 when session is revoked', async () => {
      const tokenPayload =
        await jwtTokensService.verifyRefreshToken(refreshToken);
      const activeSession = await sessionsRepository.findOneBy({
        id: tokenPayload.sid,
      });
      expect(activeSession).not.toBeNull();
      await sessionsRepository.update(
        { id: activeSession!.id },
        { revokedAt: new Date() },
      );
      const res = await agent.post('/auth/refresh');
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Invalid refresh token');
    });
  });
});
