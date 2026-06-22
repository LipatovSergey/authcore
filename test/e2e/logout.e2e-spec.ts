import { INestApplication } from '@nestjs/common';
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

describe('/auth/logout (POST)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let httpServer: App;
  let notificationsServiceMock: NotificationsServiceMock;
  let sessionToLogoutRawToken: string;
  let sessionToLogoutTokenEntity: RefreshToken | null;
  let refreshTokenRepository: Repository<RefreshToken>;
  let sessionRepository: Repository<Session>;
  let jwtTokensService: JwtTokensService;
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
  });

  afterAll(async () => {
    await app.close();
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
    const loginResponse = await request(httpServer)
      .post('/auth/login')
      .send(userLoginData);
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
});
