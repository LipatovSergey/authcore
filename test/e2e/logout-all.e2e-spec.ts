import { INestApplication, InternalServerErrorException } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource, IsNull, Repository } from 'typeorm';
import { createTestApp } from '../helpers/test-app.helper';
import {
  getLastEmailVerificationUrl,
  type NotificationsServiceMock,
} from '../mocks/notifications-service.mock';
import { RefreshToken } from '../../src/auth/entities/refresh-token.entity';
import { JwtTokensService } from '../../src/auth/tokens/jwt-tokens.service';
import { Session } from '../../src/auth/sessions/session.entity';
import { User } from '../../src/users/entities/user.entity';
import { AuthService } from '../../src/auth/auth.service';
import {
  expectCsrfCookieCleared,
  expectRefreshCookieCleared,
  getRefreshTokenFromCookie,
} from '../helpers/set-cookie-test.helper';

describe('/auth/logout-all (POST)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let httpServer: App;
  let notificationsServiceMock: NotificationsServiceMock;
  let agent: ReturnType<typeof request.agent>;
  let refreshToken1: string;
  let refreshToken2: string;
  let refreshTokenRepository: Repository<RefreshToken>;
  let jwtTokenService: JwtTokensService;
  let sessionRepository: Repository<Session>;
  let userRepository: Repository<User>;
  let userEntity: User | null;
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
    userRepository = dataSource.getRepository(User);
    jwtTokenService = app.get(JwtTokensService);
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
    const loginResponse1 = await request(httpServer)
      .post('/auth/login')
      .send(userLoginData);
    expect(loginResponse1.statusCode).toBe(200);
    refreshToken1 = getRefreshTokenFromCookie(
      loginResponse1.headers['set-cookie'],
    );

    agent = request.agent(httpServer);
    const loginResponse2 = await agent.post('/auth/login').send(userLoginData);
    expect(loginResponse2.statusCode).toBe(200);
    refreshToken2 = getRefreshTokenFromCookie(
      loginResponse2.headers['set-cookie'],
    );
    userEntity = await userRepository.findOneBy({ email: userLoginData.email });
    expect(userEntity).not.toBeNull();
  });

  it('returns 200 and revokes all user refresh tokens', async () => {
    const res = await agent.post('/auth/logout-all');
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('ok');
    const userSessions = await sessionRepository.find({
      where: { userId: userEntity!.id },
    });
    expect(userSessions.every((session) => session.revokedAt !== null)).toBe(
      true,
    );
    const userRefreshTokens = await refreshTokenRepository.find({
      where: { userId: userEntity!.id },
    });
    expect(userRefreshTokens.every((token) => token.revokedAt !== null)).toBe(
      true,
    );

    await request(httpServer)
      .post('/auth/refresh')
      .set('Cookie', `refresh_token=${refreshToken2}`)
      .expect(401);

    await request(httpServer)
      .post('/auth/refresh')
      .set('Cookie', `refresh_token=${refreshToken1}`)
      .expect(401);
  });

  it('does not revoke another user session and refresh token', async () => {
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
    const newUserEntity = await userRepository.findOneByOrFail({
      email: otherUserCredentials.email,
    });
    const otherActiveSession = await sessionRepository.findOneByOrFail({
      userId: newUserEntity.id,
      revokedAt: IsNull(),
    });
    const otherActiveRefreshToken =
      await refreshTokenRepository.findOneByOrFail({
        userId: newUserEntity.id,
        revokedAt: IsNull(),
      });
    await agent.post('/auth/logout-all').expect(200);
    const otherActiveSessionAfterLogout =
      await sessionRepository.findOneByOrFail({ id: otherActiveSession.id });
    expect(otherActiveSessionAfterLogout.revokedAt).toBeNull();
    const otherActiveRefreshTokenAfterLogout =
      await refreshTokenRepository.findOneByOrFail({
        id: otherActiveRefreshToken.id,
      });
    expect(otherActiveRefreshTokenAfterLogout.revokedAt).toBeNull();
  });

  it('returns 401 and clears the cookie when logout-all is repeated with a revoked token', async () => {
    await request(httpServer)
      .post('/auth/logout-all')
      .set('Cookie', `refresh_token=${refreshToken1}`)
      .expect(200);

    const res = await request(httpServer)
      .post('/auth/logout-all')
      .set('Cookie', `refresh_token=${refreshToken1}`);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid refresh token');
    expectRefreshCookieCleared(res.headers['set-cookie']);
    expectCsrfCookieCleared(res.headers['set-cookie']);
  });

  it('returns 401 if invalid token was passed', async () => {
    const res = await request(httpServer)
      .post('/auth/logout-all')
      .set('Cookie', 'refresh_token=invalid');
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid refresh token');
    expectRefreshCookieCleared(res.headers['set-cookie']);
    expectCsrfCookieCleared(res.headers['set-cookie']);
  });

  it('clears the refresh and CSRF cookies after successful logout-all', async () => {
    const res = await agent.post('/auth/logout-all');

    expect(res.statusCode).toBe(200);
    expectRefreshCookieCleared(res.headers['set-cookie']);
    expectCsrfCookieCleared(res.headers['set-cookie']);
  });

  it('does not authenticate with a refresh token from the request body', async () => {
    const res = await request(httpServer)
      .post('/auth/logout-all')
      .send({ refresh_token: refreshToken2 });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Refresh credentials are required');
    expectRefreshCookieCleared(res.headers['set-cookie']);
    expectCsrfCookieCleared(res.headers['set-cookie']);
  });

  it('returns 401 and clears the cookie when credentials are missing', async () => {
    const res = await request(httpServer).post('/auth/logout-all');

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Refresh credentials are required');
    expectRefreshCookieCleared(res.headers['set-cookie']);
    expectCsrfCookieCleared(res.headers['set-cookie']);
  });

  it('does not clear the refresh cookie after an internal error', async () => {
    jest
      .spyOn(authService, 'logoutAll')
      .mockRejectedValueOnce(new InternalServerErrorException());

    const res = await agent.post('/auth/logout-all');

    expect(res.statusCode).toBe(500);
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});
