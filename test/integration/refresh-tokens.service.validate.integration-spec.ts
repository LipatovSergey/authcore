import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
import { createTestApp } from '../helpers/test-app.helper';
import { RefreshToken } from '../../src/auth/entities/refresh-token.entity';
import { RefreshTokensService } from '../../src/auth/tokens/refresh-tokens.service';
import { createUserFixture } from '../helpers/user-fixture.helper';
import { JwtTokensService } from '../../src/auth/tokens/jwt-tokens.service';
import {
  SECURE_HASHER,
  type SecureHasher,
} from '../../src/auth/interfaces/secure-hasher.interface';
import { randomUUID } from 'crypto';

describe('RefreshTokensService.validateOrThrow', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let refreshTokensRepository: Repository<RefreshToken>;
  let refreshTokensService: RefreshTokensService;
  let jwtTokensService: JwtTokensService;
  let secureHasher: SecureHasher;

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    refreshTokensRepository = dataSource.getRepository(RefreshToken);
    refreshTokensService = app.get(RefreshTokensService);
    jwtTokensService = app.get(JwtTokensService);
    secureHasher = app.get(SECURE_HASHER);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  async function createRefreshTokenFixture(input: {
    userId: string;
    jti: string;
    tokenHash: string;
    expiresAt: Date;
    revokedAt?: Date | null;
  }) {
    return await refreshTokensRepository.save({
      userId: input.userId,
      jti: input.jti,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      revokedAt: input.revokedAt ?? null,
    });
  }

  it('returns token for valid refresh token', async () => {
    const { id: userId } = await createUserFixture(dataSource);
    const { rawToken, jti } = await jwtTokensService.signRefreshToken(userId);
    const tokenHash = await secureHasher.hash(rawToken);
    const storedToken = await createRefreshTokenFixture({
      userId,
      jti,
      tokenHash,
      expiresAt: new Date(Date.now() + ONE_DAY_MS),
      revokedAt: null,
    });
    const validatedToken = await refreshTokensService.validateOrThrow(rawToken);
    expect(validatedToken.id).toBe(storedToken.id);
    expect(validatedToken.userId).toBe(userId);
    expect(validatedToken.jti).toBe(storedToken.jti);
    expect(validatedToken.revokedAt).toBeNull();
  });

  it('rejects malformed/invalid JWT', async () => {
    await expect(
      refreshTokensService.validateOrThrow('invalid-jwt'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects token when database record does not exist', async () => {
    const { id: userId } = await createUserFixture(dataSource);
    const { rawToken } = await jwtTokensService.signRefreshToken(userId);
    await expect(
      refreshTokensService.validateOrThrow(rawToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects expired token without revoking active tokens', async () => {
    const { id: userId } = await createUserFixture(dataSource);
    const firstActiveToken = await createRefreshTokenFixture({
      userId,
      jti: randomUUID(),
      tokenHash: `test-token-hash-${randomUUID()}`,
      expiresAt: new Date(Date.now() + ONE_DAY_MS),
      revokedAt: null,
    });
    const secondActiveToken = await createRefreshTokenFixture({
      userId,
      jti: randomUUID(),
      tokenHash: `test-token-hash-${randomUUID()}`,
      expiresAt: new Date(Date.now() + ONE_DAY_MS),
      revokedAt: null,
    });
    const { rawToken, jti } = await jwtTokensService.signRefreshToken(userId);
    const tokenHash = await secureHasher.hash(rawToken);
    await createRefreshTokenFixture({
      userId,
      jti,
      tokenHash,
      expiresAt: new Date(Date.now() - ONE_DAY_MS),
      revokedAt: null,
    });
    await expect(
      refreshTokensService.validateOrThrow(rawToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const storedActiveTokens = await refreshTokensRepository.findBy({
      id: In([firstActiveToken.id, secondActiveToken.id]),
    });
    expect(storedActiveTokens).toHaveLength(2);
    expect(storedActiveTokens.every((token) => token.revokedAt === null)).toBe(
      true,
    );
  });

  it('rejects token with mismatched hash without revoking active tokens', async () => {
    const { id: userId } = await createUserFixture(dataSource);
    const firstActiveToken = await createRefreshTokenFixture({
      userId,
      jti: randomUUID(),
      tokenHash: `test-token-hash-${randomUUID()}`,
      expiresAt: new Date(Date.now() + ONE_DAY_MS),
      revokedAt: null,
    });
    const secondActiveToken = await createRefreshTokenFixture({
      userId,
      jti: randomUUID(),
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
      tokenHash: mismatchedTokenHash,
      expiresAt: new Date(Date.now() + ONE_DAY_MS),
      revokedAt: null,
    });
    await expect(
      refreshTokensService.validateOrThrow(rawToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const storedActiveTokens = await refreshTokensRepository.findBy({
      id: In([firstActiveToken.id, secondActiveToken.id]),
    });
    expect(storedActiveTokens).toHaveLength(2);
    expect(storedActiveTokens.every((token) => token.revokedAt === null)).toBe(
      true,
    );
  });

  it('detects reused revoked token and revokes active user tokens', async () => {
    const { id: userId } = await createUserFixture(dataSource);
    await createRefreshTokenFixture({
      userId,
      jti: randomUUID(),
      tokenHash: `test-token-hash-${randomUUID()}`,
      expiresAt: new Date(Date.now() + ONE_DAY_MS),
      revokedAt: null,
    });
    await createRefreshTokenFixture({
      userId,
      jti: randomUUID(),
      tokenHash: `test-token-hash-${randomUUID()}`,
      expiresAt: new Date(Date.now() + ONE_DAY_MS),
      revokedAt: null,
    });
    const { rawToken, jti } = await jwtTokensService.signRefreshToken(userId);
    const tokenHash = await secureHasher.hash(rawToken);
    await createRefreshTokenFixture({
      userId,
      jti,
      tokenHash,
      expiresAt: new Date(Date.now() + ONE_DAY_MS),
      revokedAt: new Date(Date.now() - ONE_DAY_MS),
    });
    await expect(
      refreshTokensService.validateOrThrow(rawToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const allUserRefreshTokens = await refreshTokensRepository.findBy({
      userId: userId,
    });
    expect(allUserRefreshTokens).toHaveLength(3);
    expect(
      allUserRefreshTokens.every((token) => token.revokedAt !== null),
    ).toBe(true);
  });

  it('does not revoke tokens of other users when reuse is detected', async () => {
    const unaffectedUser = await createUserFixture(dataSource);
    const unaffectedUserActiveToken = await createRefreshTokenFixture({
      userId: unaffectedUser.id,
      jti: randomUUID(),
      tokenHash: `test-token-hash-${randomUUID()}`,
      expiresAt: new Date(Date.now() + ONE_DAY_MS),
      revokedAt: null,
    });
    const compromisedUser = await createUserFixture(dataSource);
    await createRefreshTokenFixture({
      userId: compromisedUser.id,
      jti: randomUUID(),
      tokenHash: `test-token-hash-${randomUUID()}`,
      expiresAt: new Date(Date.now() + ONE_DAY_MS),
      revokedAt: null,
    });
    const { rawToken, jti } = await jwtTokensService.signRefreshToken(
      compromisedUser.id,
    );
    const tokenHash = await secureHasher.hash(rawToken);
    await createRefreshTokenFixture({
      userId: compromisedUser.id,
      jti,
      tokenHash,
      expiresAt: new Date(Date.now() + ONE_DAY_MS),
      revokedAt: new Date(Date.now() - ONE_DAY_MS),
    });
    await expect(
      refreshTokensService.validateOrThrow(rawToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const compromisedUserTokens = await refreshTokensRepository.findBy({
      userId: compromisedUser.id,
    });
    expect(compromisedUserTokens).toHaveLength(2);
    expect(
      compromisedUserTokens.every((token) => token.revokedAt !== null),
    ).toBe(true);
    const unaffectedUserStoredToken = await refreshTokensRepository.findOneBy({
      id: unaffectedUserActiveToken.id,
    });
    expect(unaffectedUserStoredToken?.revokedAt).toBeNull();
  });
});
