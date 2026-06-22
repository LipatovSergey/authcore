import { INestApplication } from '@nestjs/common';
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

describe('/auth/logout-all (POST)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let httpServer: App;
  let notificationsServiceMock: NotificationsServiceMock;
  let refreshToken1: string;
  let refreshToken2: string;
  let refreshTokenRepository: Repository<RefreshToken>;
  let jwtTokenService: JwtTokensService;
  let sessionRepository: Repository<Session>;
  let userRepository: Repository<User>;
  let userEntity: User | null;
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
    const loginResponse1 = await request(httpServer)
      .post('/auth/login')
      .send(userLoginData);
    expect(loginResponse1.statusCode).toBe(200);
    refreshToken1 = loginResponse1.body.refresh_token;

    const loginResponse2 = await request(httpServer)
      .post('/auth/login')
      .send(userLoginData);
    expect(loginResponse2.statusCode).toBe(200);
    refreshToken2 = loginResponse2.body.refresh_token;
    userEntity = await userRepository.findOneBy({ email: userLoginData.email });
    expect(userEntity).not.toBeNull();
  });

  it('returns 200 and revokes all user refresh tokens', async () => {
    const res = await request(httpServer).post('/auth/logout-all').send({
      refresh_token: refreshToken2,
    });
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
      .send({
        refresh_token: refreshToken2,
      })
      .expect(401);

    await request(httpServer)
      .post('/auth/refresh')
      .send({
        refresh_token: refreshToken1,
      })
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
    await request(httpServer)
      .post('/auth/logout-all')
      .send({
        refresh_token: refreshToken2,
      })
      .expect(200);
    const otherActiveSessionAfterLogout =
      await sessionRepository.findOneByOrFail({ id: otherActiveSession.id });
    expect(otherActiveSessionAfterLogout.revokedAt).toBeNull();
    const otherActiveRefreshTokenAfterLogout =
      await refreshTokenRepository.findOneByOrFail({
        id: otherActiveRefreshToken.id,
      });
    expect(otherActiveRefreshTokenAfterLogout.revokedAt).toBeNull();
  });

  it('returns 200 when logout-all is repeated with the same refresh token', async () => {
    await request(httpServer)
      .post('/auth/logout-all')
      .send({ refresh_token: refreshToken1 })
      .expect(200);

    await request(httpServer)
      .post('/auth/logout-all')
      .send({ refresh_token: refreshToken1 })
      .expect(200);
  });

  it('returns 401 if invalid token was passed', async () => {
    const res = await request(httpServer).post('/auth/logout-all').send({
      refresh_token: 'invalid refresh token',
    });
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid refresh token');
  });
});
