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
import { RefreshToken } from '../../src/auth/entities/refresh-token.entity';
import { JwtTokensService } from '../../src/auth/tokens/jwt-tokens.service';
import {
  getCsrfTokenFromCookie,
  getRefreshTokenFromCookie,
  getSetCookie,
  parseSetCookie,
} from '../helpers/set-cookie-test.helper';

describe('/auth/login (POST)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let httpServer: App;
  let notificationsServiceMock: NotificationsServiceMock;
  let sessionsRepository: Repository<Session>;
  let refreshTokensRepository: Repository<RefreshToken>;
  let jwtTokensService: JwtTokensService;

  beforeAll(async () => {
    ({ app, dataSource, httpServer, notificationsServiceMock } =
      await createTestApp());
    sessionsRepository = dataSource.getRepository(Session);
    refreshTokensRepository = dataSource.getRepository(RefreshToken);
    jwtTokensService = app.get(JwtTokensService);
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
        email: 'tester@gmail.com',
        password: 'some spaced text',
      })
      .expect(201);
    const url = getLastEmailVerificationUrl(notificationsServiceMock);
    await request(httpServer).get(`${url.pathname}${url.search}`);
  });

  it('returns 200 and an access token for valid credentials', async () => {
    const res = await request(httpServer).post('/auth/login').send({
      email: 'tester@gmail.com',
      password: 'some spaced text',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      access_token: expect.any(String),
    });
    const rawRefreshToken = getRefreshTokenFromCookie(
      res.headers['set-cookie'],
    );
    const tokenPayload =
      await jwtTokensService.verifyRefreshToken(rawRefreshToken);
    const refreshToken = await refreshTokensRepository.findOneByOrFail({
      jti: tokenPayload.jti,
    });
    const session = await sessionsRepository.findOneByOrFail({
      id: tokenPayload.sid,
    });

    expect(refreshToken.jti).toBe(tokenPayload.jti);
    expect(refreshToken.userId).toBe(tokenPayload.sub);
    expect(refreshToken.sessionId).toBe(tokenPayload.sid);
    expect(refreshToken.revokedAt).toBeNull();
    expect(refreshToken.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(session.id).toBe(tokenPayload.sid);
    expect(session.userId).toBe(tokenPayload.sub);
    expect(session.revokedAt).toBeNull();
    expect(session.lastRefreshedAt).toBeNull();
  });

  it('creates a separate session for each successful login', async () => {
    const firstLogin = await request(httpServer).post('/auth/login').send({
      email: 'tester@gmail.com',
      password: 'some spaced text',
    });
    const secondLogin = await request(httpServer).post('/auth/login').send({
      email: 'tester@gmail.com',
      password: 'some spaced text',
    });

    expect(firstLogin.statusCode).toBe(200);
    expect(secondLogin.statusCode).toBe(200);

    const firstRawRefreshToken = getRefreshTokenFromCookie(
      firstLogin.headers['set-cookie'],
    );
    const secondRawRefreshToken = getRefreshTokenFromCookie(
      secondLogin.headers['set-cookie'],
    );
    const firstRawCsrfToken = getCsrfTokenFromCookie(
      firstLogin.headers['set-cookie'],
    );
    const secondRawCsrfToken = getCsrfTokenFromCookie(
      secondLogin.headers['set-cookie'],
    );
    const firstPayload =
      await jwtTokensService.verifyRefreshToken(firstRawRefreshToken);
    const secondPayload = await jwtTokensService.verifyRefreshToken(
      secondRawRefreshToken,
    );
    const firstSession = await sessionsRepository.findOneByOrFail({
      id: firstPayload.sid,
    });
    const secondSession = await sessionsRepository.findOneByOrFail({
      id: secondPayload.sid,
    });

    expect(firstPayload.sub).toBe(secondPayload.sub);
    expect(firstPayload.sid).not.toBe(secondPayload.sid);
    expect(firstPayload.jti).not.toBe(secondPayload.jti);
    expect(firstRawCsrfToken).not.toBe(secondRawCsrfToken);
    expect(firstSession.revokedAt).toBeNull();
    expect(secondSession.revokedAt).toBeNull();
  });

  it('should set refresh token cookie on successful login', async () => {
    const res = await request(httpServer).post('/auth/login').send({
      email: 'tester@gmail.com',
      password: 'some spaced text',
    });

    expect(res.statusCode).toBe(200);
    const refreshCookie = getSetCookie(
      res.headers['set-cookie'],
      'refresh_token',
    );
    const { nameAndValue, attributes } = parseSetCookie(refreshCookie);

    expect(nameAndValue).toMatch(/^refresh_token=.+/);
    expect(attributes).toContain('HttpOnly');
    expect(attributes).toContain('Path=/auth');
    expect(attributes).toContain('SameSite=Lax');
    expect(attributes).toContain('Max-Age=604800');
    expect(attributes).not.toContain('Secure');
  });

  it('sets a frontend-readable CSRF cookie on successful login', async () => {
    const res = await request(httpServer).post('/auth/login').send({
      email: 'tester@gmail.com',
      password: 'some spaced text',
    });

    expect(res.statusCode).toBe(200);
    const csrfCookie = getSetCookie(res.headers['set-cookie'], 'csrf_token');
    const { nameAndValue, attributes } = parseSetCookie(csrfCookie);
    const rawCsrfToken = getCsrfTokenFromCookie(res.headers['set-cookie']);

    expect(nameAndValue).toBe(`csrf_token=${rawCsrfToken}`);
    expect(rawCsrfToken).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(attributes).not.toContain('HttpOnly');
    expect(attributes).toContain('Path=/');
    expect(attributes).toContain('SameSite=Lax');
    expect(attributes).toContain('Max-Age=604800');
    expect(attributes).not.toContain('Secure');
  });

  it('returns 401 when user does not exist', async () => {
    const res = await request(httpServer).post('/auth/login').send({
      email: 'no-tester@gmail.com',
      password: 'some spaced text',
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('returns 401 when password is invalid', async () => {
    const res = await request(httpServer).post('/auth/login').send({
      email: 'tester@gmail.com',
      password: 'wrong password',
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });
});
