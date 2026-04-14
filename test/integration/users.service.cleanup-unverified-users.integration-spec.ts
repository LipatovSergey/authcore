import { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { UsersService } from 'src/users/users.service';
import { User } from 'src/users/entities/user.entity';
import { EmailVerificationToken } from 'src/auth/entities/email-verification-token.entity';
import { Repository } from 'typeorm';
import { createTestApp } from '../helpers/test-app.helper';

describe('UsersService.cleanupUnverifiedUsers', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let usersService: UsersService;
  let userRepository: Repository<User>;
  let emailVerificationTokenRepository: Repository<EmailVerificationToken>;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    usersService = app.get(UsersService);
    userRepository = dataSource.getRepository(User);
    emailVerificationTokenRepository = dataSource.getRepository(
      EmailVerificationToken,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  it('returns 0 when there are no unverified cleanup candidates', async () => {
    const cutoffDate = new Date('2026-04-01T00:00:00.000Z');
    const result = await usersService.cleanupUnverifiedUsers(cutoffDate);
    expect(result).toBe(0);
  });

  it('deletes an unverified user when the user has no active email verification token', async () => {
    const cutoffDate = new Date('2026-04-01T00:00:00.000Z');
    const user = {
      email: 'test@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: false,
    };
    await userRepository.save(user);
    const cleanupResult = await usersService.cleanupUnverifiedUsers(cutoffDate);
    expect(cleanupResult).toBe(1);
    const findResult = await userRepository.findOneBy({ email: user.email });
    expect(findResult).toBe(null);
  });

  it('does not delete an unverified user when the active email verification token is newer than cutoffDate', async () => {
    const cutoffDate = new Date('2026-04-01T00:00:00.000Z');
    const user = {
      email: 'test@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: false,
    };
    const savedUser = await userRepository.save(user);
    await emailVerificationTokenRepository.save({
      userId: savedUser.id,
      jti: 'someUniqueJti',
      tokenHash: 'someTokenHash',
      createdAt: new Date('2026-04-02T00:00:00.000Z'),
      expiresAt: new Date('2026-04-03T00:00:00.000Z'),
    });
    const cleanupResult = await usersService.cleanupUnverifiedUsers(cutoffDate);
    expect(cleanupResult).toBe(0);
    const findResult = await userRepository.findOneBy({ email: user.email });
    expect(findResult).not.toBeNull();
    expect(findResult?.email).toBe(user.email);
  });

  it('deletes an unverified user when the active email verification token is older than cutoffDate', async () => {
    const cutoffDate = new Date('2026-04-02T00:00:00.000Z');
    const user = {
      email: 'test@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: false,
    };
    const savedUser = await userRepository.save(user);
    await emailVerificationTokenRepository.save({
      userId: savedUser.id,
      jti: 'someUniqueJti',
      tokenHash: 'someTokenHash',
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      expiresAt: new Date('2026-04-03T00:00:00.000Z'),
    });
    const cleanupResult = await usersService.cleanupUnverifiedUsers(cutoffDate);
    expect(cleanupResult).toBe(1);
    const findResult = await userRepository.findOneBy({ email: user.email });
    expect(findResult).toBeNull();
  });

  it('does not delete a verified user even when the active token is older than cutoffDate', async () => {
    const cutoffDate = new Date('2026-04-02T00:00:00.000Z');
    const user = {
      email: 'test@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: true,
    };
    const savedUser = await userRepository.save(user);
    await emailVerificationTokenRepository.save({
      userId: savedUser.id,
      jti: 'someUniqueJti',
      tokenHash: 'someTokenHash',
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      expiresAt: new Date('2026-04-03T00:00:00.000Z'),
    });
    const cleanupResult = await usersService.cleanupUnverifiedUsers(cutoffDate);
    expect(cleanupResult).toBe(0);
    const findResult = await userRepository.findOneBy({ email: user.email });
    expect(findResult).not.toBeNull();
    expect(findResult?.email).toBe(user.email);
  });

  it('does not treat used token as active', async () => {
    const cutoffDate = new Date('2026-04-02T00:00:00.000Z');
    const user = {
      email: 'test@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: false,
    };
    const savedUser = await userRepository.save(user);
    await emailVerificationTokenRepository.save({
      userId: savedUser.id,
      jti: 'someUniqueJti',
      tokenHash: 'someTokenHash',
      usedAt: new Date('2026-04-03T00:00:00.000Z'),
      createdAt: new Date('2026-04-03T00:00:00.000Z'),
      expiresAt: new Date('2026-04-04T00:00:00.000Z'),
    });
    const cleanupResult = await usersService.cleanupUnverifiedUsers(cutoffDate);
    expect(cleanupResult).toBe(1);
    const findResult = await userRepository.findOneBy({ email: user.email });
    expect(findResult).toBeNull();
  });

  it('does not treat revoked token as active', async () => {
    const cutoffDate = new Date('2026-04-02T00:00:00.000Z');
    const user = {
      email: 'test@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: false,
    };
    const savedUser = await userRepository.save(user);
    await emailVerificationTokenRepository.save({
      userId: savedUser.id,
      jti: 'someUniqueJti',
      tokenHash: 'someTokenHash',
      revokedAt: new Date('2026-04-03T00:00:00.000Z'),
      createdAt: new Date('2026-04-03T00:00:00.000Z'),
      expiresAt: new Date('2026-04-04T00:00:00.000Z'),
    });
    const cleanupResult = await usersService.cleanupUnverifiedUsers(cutoffDate);
    expect(cleanupResult).toBe(1);
    const findResult = await userRepository.findOneBy({ email: user.email });
    expect(findResult).toBeNull();
  });

  it('deletes only cleanup candidates in a mixed dataset', async () => {
    const cutoffDate = new Date('2026-04-02T00:00:00.000Z');
    // create unverified user without active token
    const unverifiedUserWithoutActiveToken = {
      email: 'unverifiedUserWithoutActiveToken@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: false,
    };
    await userRepository.save(unverifiedUserWithoutActiveToken);
    // create unverified user with old token
    const unverifiedUserWithOldToken = {
      email: 'unverifiedUserWithOldToken@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: false,
    };
    const savedUnverifiedUserWithOldToken = await userRepository.save(
      unverifiedUserWithOldToken,
    );
    await emailVerificationTokenRepository.save({
      userId: savedUnverifiedUserWithOldToken.id,
      jti: 'someUniqueJti',
      tokenHash: 'someTokenHash',
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      expiresAt: new Date('2026-04-03T00:00:00.000Z'),
    });
    // create unverified user with fresh token
    const unverifiedUserWithFreshToken = {
      email: 'unverifiedUserWithFreshToken@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: false,
    };
    const savedUnverifiedUserWithFreshToken = await userRepository.save(
      unverifiedUserWithFreshToken,
    );
    await emailVerificationTokenRepository.save({
      userId: savedUnverifiedUserWithFreshToken.id,
      jti: 'someUniqueJti1',
      tokenHash: 'someTokenHash',
      createdAt: new Date('2026-04-03T00:00:00.000Z'),
      expiresAt: new Date('2026-04-04T00:00:00.000Z'),
    });
    // create verified user
    const verifiedUser = {
      email: 'verifiedUser@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: true,
    };
    await userRepository.save(verifiedUser);
    const cleanupResult = await usersService.cleanupUnverifiedUsers(cutoffDate);
    expect(cleanupResult).toBe(2);
    const findUnverifiedUserWithoutActiveToken = await userRepository.findOneBy(
      {
        email: unverifiedUserWithoutActiveToken.email,
      },
    );
    expect(findUnverifiedUserWithoutActiveToken).toBeNull();
    const findUnverifiedUserWithOldToken = await userRepository.findOneBy({
      email: unverifiedUserWithOldToken.email,
    });
    expect(findUnverifiedUserWithOldToken).toBeNull();
    const findUnverifiedUserWithFreshToken = await userRepository.findOneBy({
      email: unverifiedUserWithFreshToken.email,
    });
    expect(findUnverifiedUserWithFreshToken).not.toBeNull();
    const findVerifiedUser = await userRepository.findOneBy({
      email: verifiedUser.email,
    });
    expect(findVerifiedUser).not.toBeNull();
  });

  it.only('does not delete an unverified user when the active email verification token createdAt equals cutoffDate', async () => {
    const cutoffDate = new Date('2026-04-02T00:00:00.000Z');
    const user = {
      email: 'test@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: false,
    };
    const savedUser = await userRepository.save(user);
    await emailVerificationTokenRepository.save({
      userId: savedUser.id,
      jti: 'someUniqueJti',
      tokenHash: 'someTokenHash',
      createdAt: new Date('2026-04-02T00:00:00.000Z'),
      expiresAt: new Date('2026-04-03T00:00:00.000Z'),
    });
    const cleanupResult = await usersService.cleanupUnverifiedUsers(cutoffDate);
    expect(cleanupResult).toBe(0);
    const findResult = await userRepository.findOneBy({ email: user.email });
    expect(findResult).not.toBeNull();
  });
});
