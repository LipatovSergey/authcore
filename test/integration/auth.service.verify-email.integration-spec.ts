import { INestApplication, UnauthorizedException } from '@nestjs/common';
import type { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { createTestApp } from '../helpers/test-app.helper';
import { AuthService, VERIFY_EMAIL_OUTCOME } from '../../src/auth/auth.service';
import { EmailVerificationToken } from '../../src/auth/entities/email-verification-token.entity';
import { EmailVerificationTokensService } from '../../src/auth/tokens/email-verification-tokens.service';
import { JwtTokensService } from '../../src/auth/tokens/jwt-tokens.service';
import { createEmailVerificationTokenFixture } from '../helpers/email-verification-token.helper';
import {
  SECURE_HASHER,
  type SecureHasher,
} from '../../src/auth/interfaces/secure-hasher.interface';

describe('AuthService.verifyEmail', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let usersRepository: Repository<User>;
  let emailVerificationTokenRepository: Repository<EmailVerificationToken>;
  let emailVerificationTokensService: EmailVerificationTokensService;
  let authService: AuthService;
  let jwtTokensService: JwtTokensService;
  let secureHasher: SecureHasher;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    usersRepository = dataSource.getRepository(User);
    emailVerificationTokenRepository = dataSource.getRepository(
      EmailVerificationToken,
    );
    emailVerificationTokensService = app.get(EmailVerificationTokensService);
    jwtTokensService = app.get(JwtTokensService);
    authService = app.get(AuthService);
    secureHasher = app.get<SecureHasher>(SECURE_HASHER);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  it('verifies unverified user and marks token as used', async () => {
    const userBefore = await usersRepository.save({
      email: 'test@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: false,
      unverifiedExpiresAt: new Date('2026-04-01T00:00:00.000Z'),
    });

    const { rawToken, token } = await createEmailVerificationTokenFixture({
      dataSource,
      jwtTokensService,
      emailVerificationTokensService,
      userId: userBefore.id,
    });

    const result = await authService.verifyEmail(rawToken);

    const userAfter = await usersRepository.findOneBy({ id: userBefore.id });
    const tokenAfter = await emailVerificationTokenRepository.findOneBy({
      jti: token.jti,
    });
    if (!userAfter || !tokenAfter) {
      throw new Error('Expected user and token to exist after verification');
    }

    expect(result).toBe(VERIFY_EMAIL_OUTCOME.VERIFIED);
    expect(userAfter.isEmailVerified).toBe(true);
    expect(userAfter.emailVerifiedAt).toBeInstanceOf(Date);
    expect(userAfter.unverifiedExpiresAt).toBeNull();
    expect(tokenAfter.usedAt).toBeInstanceOf(Date);
    expect(tokenAfter.revokedAt).toBeNull();
  });

  it('returns ALREADY_VERIFIED if user is already verified', async () => {
    const emailVerifiedAt = new Date('2026-04-01T00:00:00.000Z');
    const userBefore = await usersRepository.save({
      email: 'test@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: true,
      emailVerifiedAt,
      unverifiedExpiresAt: null,
    });

    const { rawToken, token } = await createEmailVerificationTokenFixture({
      dataSource,
      jwtTokensService,
      emailVerificationTokensService,
      userId: userBefore.id,
    });

    const result = await authService.verifyEmail(rawToken);

    const userAfter = await usersRepository.findOneBy({ id: userBefore.id });
    const tokenAfter = await emailVerificationTokenRepository.findOneBy({
      jti: token.jti,
    });
    if (!userAfter || !tokenAfter) {
      throw new Error('Expected user and token to exist after verification');
    }

    expect(result).toBe(VERIFY_EMAIL_OUTCOME.ALREADY_VERIFIED);
    expect(userAfter.isEmailVerified).toBe(true);
    expect(userAfter.emailVerifiedAt).toEqual(emailVerifiedAt);
    expect(userAfter.unverifiedExpiresAt).toBeNull();
    expect(tokenAfter.usedAt).toBeNull();
    expect(tokenAfter.revokedAt).toBeNull();
  });

  it('rejects revoked token without changing user state', async () => {
    const unverifiedExpiresAt = new Date('2026-04-01T00:00:00.000Z');
    const revokedAt = new Date('2026-04-02T00:00:00.000Z');
    const userBefore = await usersRepository.save({
      email: 'test@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: false,
      unverifiedExpiresAt,
    });

    const { rawToken, token } = await createEmailVerificationTokenFixture({
      dataSource,
      jwtTokensService,
      emailVerificationTokensService,
      userId: userBefore.id,
      overrides: { revokedAt },
    });

    await expect(authService.verifyEmail(rawToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const userAfter = await usersRepository.findOneBy({ id: userBefore.id });
    const tokenAfter = await emailVerificationTokenRepository.findOneBy({
      jti: token.jti,
    });
    if (!userAfter || !tokenAfter) {
      throw new Error('Expected user and token to exist after failed verify');
    }

    expect(userAfter.isEmailVerified).toBe(false);
    expect(userAfter.emailVerifiedAt).toBeNull();
    expect(userAfter.unverifiedExpiresAt).toEqual(unverifiedExpiresAt);
    expect(tokenAfter.usedAt).toBeNull();
    expect(tokenAfter.revokedAt).toEqual(revokedAt);
  });

  it('rejects used token without changing user state', async () => {
    const unverifiedExpiresAt = new Date('2026-04-01T00:00:00.000Z');
    const usedAt = new Date('2026-04-02T00:00:00.000Z');
    const userBefore = await usersRepository.save({
      email: 'test@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: false,
      unverifiedExpiresAt,
    });

    const { rawToken, token } = await createEmailVerificationTokenFixture({
      dataSource,
      jwtTokensService,
      emailVerificationTokensService,
      userId: userBefore.id,
      overrides: { usedAt },
    });

    await expect(authService.verifyEmail(rawToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const userAfter = await usersRepository.findOneBy({ id: userBefore.id });
    const tokenAfter = await emailVerificationTokenRepository.findOneBy({
      jti: token.jti,
    });
    if (!userAfter || !tokenAfter) {
      throw new Error('Expected user and token to exist after failed verify');
    }

    expect(userAfter.isEmailVerified).toBe(false);
    expect(userAfter.emailVerifiedAt).toBeNull();
    expect(userAfter.unverifiedExpiresAt).toEqual(unverifiedExpiresAt);
    expect(tokenAfter.usedAt).toEqual(usedAt);
    expect(tokenAfter.revokedAt).toBeNull();
  });

  it('rejects expired token without changing user state', async () => {
    const unverifiedExpiresAt = new Date('2026-04-01T00:00:00.000Z');
    const userBefore = await usersRepository.save({
      email: 'test@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: false,
      unverifiedExpiresAt,
    });

    const { rawToken, token } = await createEmailVerificationTokenFixture({
      dataSource,
      jwtTokensService,
      emailVerificationTokensService,
      userId: userBefore.id,
      overrides: {
        expiresAt: new Date('2020-01-01T00:00:00.000Z'),
      },
    });

    await expect(authService.verifyEmail(rawToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const userAfter = await usersRepository.findOneBy({ id: userBefore.id });
    const tokenAfter = await emailVerificationTokenRepository.findOneBy({
      jti: token.jti,
    });
    if (!userAfter || !tokenAfter) {
      throw new Error('Expected user and token to exist after failed verify');
    }

    expect(userAfter.isEmailVerified).toBe(false);
    expect(userAfter.emailVerifiedAt).toBeNull();
    expect(userAfter.unverifiedExpiresAt).toEqual(unverifiedExpiresAt);
    expect(tokenAfter.usedAt).toBeNull();
    expect(tokenAfter.revokedAt).toBeNull();
  });

  it('rejects token with mismatched hash without changing user state', async () => {
    const unverifiedExpiresAt = new Date('2026-04-01T00:00:00.000Z');
    const userBefore = await usersRepository.save({
      email: 'test@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: false,
      unverifiedExpiresAt,
    });

    const { rawToken, token } = await createEmailVerificationTokenFixture({
      dataSource,
      jwtTokensService,
      emailVerificationTokensService,
      userId: userBefore.id,
    });
    const wrongTokenHash = await secureHasher.hash('different-token');
    await emailVerificationTokenRepository.update(token.id, {
      tokenHash: wrongTokenHash,
    });

    await expect(authService.verifyEmail(rawToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const userAfter = await usersRepository.findOneBy({ id: userBefore.id });
    const tokenAfter = await emailVerificationTokenRepository.findOneBy({
      jti: token.jti,
    });
    if (!userAfter || !tokenAfter) {
      throw new Error('Expected user and token to exist after failed verify');
    }

    expect(userAfter.isEmailVerified).toBe(false);
    expect(userAfter.emailVerifiedAt).toBeNull();
    expect(userAfter.unverifiedExpiresAt).toEqual(unverifiedExpiresAt);
    expect(tokenAfter.usedAt).toBeNull();
    expect(tokenAfter.revokedAt).toBeNull();
  });
});
