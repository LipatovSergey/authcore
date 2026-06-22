import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { createTestApp } from '../helpers/test-app.helper';
import { RefreshToken } from '../../src/auth/entities/refresh-token.entity';
import { RefreshTokensService } from '../../src/auth/tokens/refresh-tokens.service';
import { randomUUID } from 'crypto';
import { createUserFixture } from '../helpers/user-fixture.helper';
import { Session } from '../../src/auth/sessions/session.entity';

describe('RefreshTokensService.cleanupStaleTokens', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let refreshTokensRepository: Repository<RefreshToken>;
  let refreshTokensService: RefreshTokensService;
  let sessionRepository: Repository<Session>;

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    refreshTokensRepository = dataSource.getRepository(RefreshToken);
    refreshTokensService = app.get(RefreshTokensService);
    sessionRepository = dataSource.getRepository(Session);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  async function createSessionFixture(userId: string) {
    return sessionRepository.save({
      userId,
      userAgent: null,
      ipAddress: null,
      lastRefreshedAt: null,
      revokedAt: null,
    });
  }

  async function createRefreshToken(data: {
    userId: string;
    sessionId: string;
    expiresAt: Date;
    revokedAt?: Date | null;
  }) {
    return refreshTokensRepository.save({
      userId: data.userId,
      jti: randomUUID(),
      sessionId: data.sessionId,
      tokenHash: `test-token-hash-${randomUUID()}`,
      expiresAt: data.expiresAt,
      revokedAt: data.revokedAt ?? null,
    });
  }

  it('deletes refresh tokens with revokedAt before cutoff', async () => {
    const { id: userId } = await createUserFixture(dataSource);
    const { id: sessionId } = await createSessionFixture(userId);
    const cutoffMs = Date.parse('2026-06-01T00:00:00.000Z');
    const token = await createRefreshToken({
      userId,
      sessionId,
      expiresAt: new Date(cutoffMs + ONE_DAY_MS),
      revokedAt: new Date(cutoffMs - ONE_DAY_MS),
    });
    const cleanupResult = await refreshTokensService.cleanupStaleTokens(
      new Date(cutoffMs),
    );
    expect(cleanupResult).toBe(1);
    const findResult = await refreshTokensRepository.findOneBy({
      id: token.id,
    });
    expect(findResult).toBeNull();
  });

  it('deletes refresh tokens with expiresAt before cutoff', async () => {
    const { id: userId } = await createUserFixture(dataSource);
    const { id: sessionId } = await createSessionFixture(userId);
    const cutoffMs = Date.parse('2026-06-01T00:00:00.000Z');
    const token = await createRefreshToken({
      userId,
      sessionId,
      expiresAt: new Date(cutoffMs - ONE_DAY_MS),
      revokedAt: null,
    });
    const cleanupResult = await refreshTokensService.cleanupStaleTokens(
      new Date(cutoffMs),
    );
    expect(cleanupResult).toBe(1);
    const findResult = await refreshTokensRepository.findOneBy({
      id: token.id,
    });
    expect(findResult).toBeNull();
  });

  it('keeps active non-expired tokens', async () => {
    const { id: userId } = await createUserFixture(dataSource);
    const { id: sessionId } = await createSessionFixture(userId);
    const cutoffMs = Date.parse('2026-06-01T00:00:00.000Z');
    const token = await createRefreshToken({
      userId,
      sessionId,
      expiresAt: new Date(cutoffMs + ONE_DAY_MS),
      revokedAt: null,
    });
    const cleanupResult = await refreshTokensService.cleanupStaleTokens(
      new Date(cutoffMs),
    );
    expect(cleanupResult).toBe(0);
    const findResult = await refreshTokensRepository.findOneBy({
      id: token.id,
    });
    expect(findResult).not.toBeNull();
  });

  it('keeps revoked tokens when revokedAt is after cutoff', async () => {
    const { id: userId } = await createUserFixture(dataSource);
    const { id: sessionId } = await createSessionFixture(userId);
    const cutoffMs = Date.parse('2026-06-01T00:00:00.000Z');
    const token = await createRefreshToken({
      userId,
      sessionId,
      expiresAt: new Date(cutoffMs + ONE_DAY_MS),
      revokedAt: new Date(cutoffMs + ONE_DAY_MS),
    });
    const cleanupResult = await refreshTokensService.cleanupStaleTokens(
      new Date(cutoffMs),
    );
    expect(cleanupResult).toBe(0);
    const findResult = await refreshTokensRepository.findOneBy({
      id: token.id,
    });
    expect(findResult).not.toBeNull();
  });
});
