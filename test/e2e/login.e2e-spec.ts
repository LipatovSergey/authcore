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
import { RefreshTokensService } from '../../src/auth/tokens/refresh-tokens.service';

describe('/auth/login (POST)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let httpServer: App;
  let notificationsServiceMock: NotificationsServiceMock;
  let sessionsRepository: Repository<Session>;
  let refreshTokensService: RefreshTokensService;

  beforeAll(async () => {
    ({ app, dataSource, httpServer, notificationsServiceMock } =
      await createTestApp());
    sessionsRepository = dataSource.getRepository(Session);
    refreshTokensService = app.get(RefreshTokensService);
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

  it('returns 200 and auth tokens for valid credentials', async () => {
    const res = await request(httpServer).post('/auth/login').send({
      email: 'tester@gmail.com',
      password: 'some spaced text',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      access_token: expect.any(String),
      refresh_token: expect.any(String),
    });
    const rawRefreshToken = res.body.refresh_token;
    const validRefreshToken =
      await refreshTokensService.validateActiveForRotationOrThrow(
        rawRefreshToken,
      );
    const session = await sessionsRepository.findOneByOrFail({
      id: validRefreshToken.sessionId,
    });
    expect(session.userId).toBe(validRefreshToken.userId);
    expect(session.revokedAt).toBeNull();
    expect(session.lastRefreshedAt).toBeNull();
  });

  it('should set refresh token cookie on successful login', async () => {
    const res = await request(httpServer).post('/auth/login').send({
      email: 'tester@gmail.com',
      password: 'some spaced text',
    });

    expect(res.statusCode).toBe(200);
    const setCookieHeader: unknown = res.headers['set-cookie'];
    expect(setCookieHeader).toBeDefined();
    const cookies = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : [setCookieHeader];
    const refreshCookie = cookies.find(
      (cookie): cookie is string =>
        typeof cookie === 'string' && cookie.startsWith('refresh_token='),
    );
    if (!refreshCookie) {
      throw new Error('Refresh token cookie was not set');
    }
    const [, ...attributes] = refreshCookie
      .split(';')
      .map((part) => part.trim());
    const attributeSet = new Set(attributes);
    expect(attributeSet).toContain('HttpOnly');
    expect(attributeSet).toContain('Path=/auth');
    expect(attributeSet).toContain('SameSite=Lax');
    expect(attributeSet).toContain('Max-Age=604800');
    expect(attributeSet).not.toContain('Secure');
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
