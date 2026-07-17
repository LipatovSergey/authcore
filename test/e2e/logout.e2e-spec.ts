import { INestApplication, InternalServerErrorException } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { createTestApp } from '../helpers/test-app.helper';
import {
  getLastEmailVerificationUrl,
  type NotificationsServiceMock,
} from '../mocks/notifications-service.mock';
import { RefreshToken } from '../../src/auth/entities/refresh-token.entity';
import { Session } from '../../src/auth/sessions/session.entity';
import { JwtTokensService } from '../../src/auth/tokens/jwt-tokens.service';
import { AuthService } from '../../src/auth/auth.service';
import { expectRefreshCookieCleared } from '../helpers/set-cookie-test.helper';

describe('/auth/logout (POST)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let httpServer: App;
  let notificationsServiceMock: NotificationsServiceMock;
  let agent: ReturnType<typeof request.agent>;
  let sessionToLogoutRawToken: string;
  let sessionToLogoutTokenEntity: RefreshToken | null;
  let refreshTokenRepository: Repository<RefreshToken>;
  let sessionRepository: Repository<Session>;
  let jwtTokensService: JwtTokensService;
  let authService: AuthService;
  const userLoginData = {
    email: 'tester@gmail.com',
    password: 'some spaced text',
  };

  beforeAll(async () => {
    ({ app, dataSource, httpServer, notificationsServiceMock } =
      await createTestApp());
    refreshTokenRepository = dataSource.getRepository(RefreshToken);
    sessionRepository = dataSource.getRepository(Session);
    jwtTokensService = app.get(JwtTokensService);
    authService = app.get(AuthService);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    notificationsServiceMock.reset();
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    const registerResponse = await request(httpServer)
      .post('/auth/register')
      .send({
        email: 'tester@gmail.com',
        password: 'some spaced text',
      });
    expect(registerResponse.statusCode).toBe(201);

    const url = getLastEmailVerificationUrl(notificationsServiceMock);
    await request(httpServer).get(`${url.pathname}${url.search}`);
    agent = request.agent(httpServer);
    const loginResponse = await agent.post('/auth/login').send(userLoginData);
    expect(loginResponse.statusCode).toBe(200);
    sessionToLogoutRawToken = loginResponse.body.refresh_token;
    const sessionToLogoutTokenPayload =
      await jwtTokensService.verifyRefreshToken(sessionToLogoutRawToken);
    sessionToLogoutTokenEntity = await refreshTokenRepository.findOneBy({
      jti: sessionToLogoutTokenPayload.jti,
    });
  });

  it('returns 200 if logout succeeds', async () => {
    const res = await request(httpServer).post('/auth/logout').send({
      refresh_token: sessionToLogoutRawToken,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('ok');
    const sessionToLogout = await sessionRepository.findOneBy({
      id: sessionToLogoutTokenEntity!.sessionId,
    });
    expect(sessionToLogout).not.toBeNull();
    expect(sessionToLogout!.revokedAt).not.toBeNull();
    const sessionToLogoutTokens = await refreshTokenRepository.find({
      where: { sessionId: sessionToLogout!.id },
    });
    expect(
      sessionToLogoutTokens.every((token) => token.revokedAt !== null),
    ).toBe(true);
  });

  it('does not revoke another session of the same user', async () => {
    const remainingSessionLoginResponse = await request(httpServer)
      .post('/auth/login')
      .send(userLoginData);
    const remainingSessionTokenPayload =
      await jwtTokensService.verifyRefreshToken(
        remainingSessionLoginResponse.body.refresh_token,
      );
    const remainingSessionTokenEntity = await refreshTokenRepository.findOneBy({
      jti: remainingSessionTokenPayload.jti,
    });
    expect(remainingSessionTokenEntity).not.toBeNull();
    expect(remainingSessionTokenEntity!.revokedAt).toBeNull();
    await request(httpServer).post('/auth/logout').send({
      refresh_token: sessionToLogoutRawToken,
    });
    const remainingSession = await sessionRepository.findOneBy({
      id: remainingSessionTokenEntity!.sessionId,
    });
    expect(remainingSession).not.toBeNull();
    expect(remainingSession!.revokedAt).toBeNull();
  });

  it('returns 401 if invalid token was passed', async () => {
    const res = await request(httpServer).post('/auth/logout').send({
      refresh_token: 'invalid refresh token',
    });
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid refresh token');
  });

  it('returns 200 when logout is repeated with an already revoked token', async () => {
    await request(httpServer)
      .post('/auth/logout')
      .send({
        refresh_token: sessionToLogoutRawToken,
      })
      .expect(200);

    const res = await request(httpServer).post('/auth/logout').send({
      refresh_token: sessionToLogoutRawToken,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('ok');
  });

  describe('cookie transport', () => {
    it('returns 200 and revokes the current session', async () => {
      const res = await agent.post('/auth/logout');

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('ok');
      const session = await sessionRepository.findOneByOrFail({
        id: sessionToLogoutTokenEntity!.sessionId,
      });
      expect(session.revokedAt).not.toBeNull();
    });

    it('clears the refresh cookie after successful logout', async () => {
      const res = await agent.post('/auth/logout');

      expect(res.statusCode).toBe(200);
      expectRefreshCookieCleared(res.headers['set-cookie']);
    });

    it('cannot refresh through the same agent after logout', async () => {
      await agent.post('/auth/logout').expect(200);

      await agent.post('/auth/refresh').expect(401);
    });

    it('prefers cookie when body also contains a refresh token', async () => {
      const res = await agent
        .post('/auth/logout')
        .send({ refresh_token: 'invalid refresh token' });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('ok');
    });

    it('returns 401 and clears an invalid refresh cookie', async () => {
      const res = await request(httpServer)
        .post('/auth/logout')
        .set('Cookie', 'refresh_token=invalid');

      expect(res.statusCode).toBe(401);
      expectRefreshCookieCleared(res.headers['set-cookie']);
    });

    it('returns 401 and clears the cookie when credentials are missing', async () => {
      const res = await request(httpServer).post('/auth/logout');

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Refresh credentials are required');
      expectRefreshCookieCleared(res.headers['set-cookie']);
    });

    it('does not clear the refresh cookie after an internal error', async () => {
      jest
        .spyOn(authService, 'logout')
        .mockRejectedValueOnce(new InternalServerErrorException());

      const res = await agent.post('/auth/logout');

      expect(res.statusCode).toBe(500);
      expect(res.headers['set-cookie']).toBeUndefined();
    });
  });
});
