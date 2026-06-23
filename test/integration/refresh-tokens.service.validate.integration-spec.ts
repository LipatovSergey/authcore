import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
import { createTestApp } from '../helpers/test-app.helper';
import { RefreshToken } from '../../src/auth/entities/refresh-token.entity';
import { RefreshTokensService } from '../../src/auth/tokens/refresh-tokens.service';
import { createUserFixture } from '../helpers/user-fixture.helper';
import { JwtTokensService } from '../../src/auth/tokens/jwt-tokens.service';
import { Session } from '../../src/auth/sessions/session.entity';
import {
  SECURE_HASHER,
  type SecureHasher,
} from '../../src/auth/interfaces/secure-hasher.interface';
import { randomUUID } from 'crypto';
import { RefreshTokenReuseDetectedError } from '../../src/auth/tokens/refresh-token-reuse-detected.error';

describe('RefreshTokensService.validateOrThrow', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let refreshTokensRepository: Repository<RefreshToken>;
  let refreshTokensService: RefreshTokensService;
  let jwtTokensService: JwtTokensService;
  let secureHasher: SecureHasher;
  let sessionRepository: Repository<Session>;

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    refreshTokensRepository = dataSource.getRepository(RefreshToken);
    refreshTokensService = app.get(RefreshTokensService);
    jwtTokensService = app.get(JwtTokensService);
    secureHasher = app.get(SECURE_HASHER);
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

  async function createRefreshTokenFixture(input: {
    userId: string;
    jti: string;
    sessionId: string;
    tokenHash: string;
    expiresAt: Date;
    revokedAt?: Date | null;
  }) {
    return refreshTokensRepository.save({
      userId: input.userId,
      jti: input.jti,
      sessionId: input.sessionId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      revokedAt: input.revokedAt ?? null,
    });
  }

  it('returns token for valid refresh token', async () => {
    const { id: userId } = await createUserFixture(dataSource);
    const { rawToken, jti } = await jwtTokensService.signRefreshToken(userId);
    const tokenHash = await secureHasher.hash(rawToken);
    const { id: sessionId } = await createSessionFixture(userId);
    const storedToken = await createRefreshTokenFixture({
      userId,
      jti,
      sessionId,
      tokenHash,
      expiresAt: new Date(Date.now() + ONE_DAY_MS),
      revokedAt: null,
    });
    const validatedToken =
      await refreshTokensService.validateActiveForRotationOrThrow(rawToken);
    expect(validatedToken.id).toBe(storedToken.id);
    expect(validatedToken.userId).toBe(userId);
    expect(validatedToken.jti).toBe(storedToken.jti);
    expect(validatedToken.revokedAt).toBeNull();
  });

  it('rejects malformed/invalid JWT', async () => {
    await expect(
      refreshTokensService.validateActiveForRotationOrThrow('invalid-jwt'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects token when database record does not exist', async () => {
    const { id: userId } = await createUserFixture(dataSource);
    const { rawToken } = await jwtTokensService.signRefreshToken(userId);
    await expect(
      refreshTokensService.validateActiveForRotationOrThrow(rawToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects expired refresh token', async () => {
    const { id: userId } = await createUserFixture(dataSource);
    const { id: sessionId } = await createSessionFixture(userId);
    const firstActiveToken = await createRefreshTokenFixture({
      userId,
      jti: randomUUID(),
      sessionId,
      tokenHash: `test-token-hash-${randomUUID()}`,
      expiresAt: new Date(Date.now() + ONE_DAY_MS),
      revokedAt: null,
    });
    const secondActiveToken = await createRefreshTokenFixture({
      userId,
      jti: randomUUID(),
      sessionId,
      tokenHash: `test-token-hash-${randomUUID()}`,
      expiresAt: new Date(Date.now() + ONE_DAY_MS),
      revokedAt: null,
    });
    const { rawToken, jti } = await jwtTokensService.signRefreshToken(userId);
    const tokenHash = await secureHasher.hash(rawToken);
    await createRefreshTokenFixture({
      userId,
      jti,
      sessionId,
      tokenHash,
      expiresAt: new Date(Date.now() - ONE_DAY_MS),
      revokedAt: null,
    });
    await expect(
      refreshTokensService.validateActiveForRotationOrThrow(rawToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const storedActiveTokens = await refreshTokensRepository.findBy({
      id: In([firstActiveToken.id, secondActiveToken.id]),
    });
    expect(storedActiveTokens).toHaveLength(2);
    expect(storedActiveTokens.every((token) => token.revokedAt === null)).toBe(
      true,
    );
  });

  it('rejects token with mismatched hash', async () => {
    const { id: userId } = await createUserFixture(dataSource);
    const { id: sessionId } = await createSessionFixture(userId);
    const firstActiveToken = await createRefreshTokenFixture({
      userId,
      jti: randomUUID(),
      sessionId,
      tokenHash: `test-token-hash-${randomUUID()}`,
      expiresAt: new Date(Date.now() + ONE_DAY_MS),
      revokedAt: null,
    });
    const secondActiveToken = await createRefreshTokenFixture({
      userId,
      jti: randomUUID(),
      sessionId,
      tokenHash: `test-token-hash-${randomUUID()}`,
      expiresAt: new Date(Date.now() + ONE_DAY_MS),
      revokedAt: null,
    });
    const { rawToken, jti } = await jwtTokensService.signRefreshToken(userId);
    const mismatchedTokenHash = await secureHasher.hash(
      'different-refresh-token',
    );
    await createRefreshTokenFixture({
      userId,
      jti,
      sessionId,
      tokenHash: mismatchedTokenHash,
      expiresAt: new Date(Date.now() + ONE_DAY_MS),
      revokedAt: null,
    });
    await expect(
      refreshTokensService.validateActiveForRotationOrThrow(rawToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const storedActiveTokens = await refreshTokensRepository.findBy({
      id: In([firstActiveToken.id, secondActiveToken.id]),
    });
    expect(storedActiveTokens).toHaveLength(2);
    expect(storedActiveTokens.every((token) => token.revokedAt === null)).toBe(
      true,
    );
  });

  it('detects reused revoked token and throw error', async () => {
    const { id: userId } = await createUserFixture(dataSource);
    const { id: sessionId } = await createSessionFixture(userId);
    await createRefreshTokenFixture({
      userId,
      jti: randomUUID(),
      sessionId,
      tokenHash: `test-token-hash-${randomUUID()}`,
      expiresAt: new Date(Date.now() + ONE_DAY_MS),
      revokedAt: null,
    });
    await createRefreshTokenFixture({
      userId,
      jti: randomUUID(),
      sessionId,
      tokenHash: `test-token-hash-${randomUUID()}`,
      expiresAt: new Date(Date.now() + ONE_DAY_MS),
      revokedAt: null,
    });
    const { rawToken, jti } = await jwtTokensService.signRefreshToken(userId);
    const tokenHash = await secureHasher.hash(rawToken);
    await createRefreshTokenFixture({
      userId,
      jti,
      sessionId,
      tokenHash,
      expiresAt: new Date(Date.now() + ONE_DAY_MS),
      revokedAt: new Date(Date.now() - ONE_DAY_MS),
    });
    const validation =
      refreshTokensService.validateActiveForRotationOrThrow(rawToken);

    await expect(validation).rejects.toBeInstanceOf(
      RefreshTokenReuseDetectedError,
    );

    await expect(validation).rejects.toHaveProperty('userId', userId);
  });
});
