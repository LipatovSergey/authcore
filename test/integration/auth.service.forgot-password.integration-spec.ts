import { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { UsersService } from 'src/users/users.service';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { createTestApp } from '../helpers/test-app.helper';
import { PasswordResetToken } from '../../src/auth/entities/password-reset-token.entity';
import { AuthService } from '../../src/auth/auth.service';

describe('AuthService.forgotPassword', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let usersService: UsersService;
  let userRepository: Repository<User>;
  let passwordResetTokensRepository: Repository<PasswordResetToken>;
  let authService: AuthService;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    usersService = app.get(UsersService);
    userRepository = dataSource.getRepository(User);
    passwordResetTokensRepository =
      dataSource.getRepository(PasswordResetToken);
    authService = app.get(AuthService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  it('creates password reset token for verified user', async () => {
    const user = {
      email: 'test@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: true,
      emailVerifiedAt: new Date('2026-04-01T00:00:00.000Z'),
      unverifiedExpiresAt: null,
    };
    const userRecord = await userRepository.save(user);
    await authService.forgotPassword({ email: user.email });
    const token = await passwordResetTokensRepository.findOneBy({
      userId: userRecord.id,
    });

    expect(token).not.toBeNull();
    if (!token) {
      throw new Error('Expected password reset token to be created');
    }
    expect(token.userId).toBe(userRecord.id);
    expect(typeof token.jti).toBe('string');
    expect(token.jti.length).toBeGreaterThan(0);
    expect(typeof token.tokenHash).toBe('string');
    expect(token.tokenHash.length).toBeGreaterThan(0);
    expect(token.expiresAt).toBeInstanceOf(Date);
    expect(token.createdAt).toBeInstanceOf(Date);
    expect(token.usedAt).toBeNull();
    expect(token.revokedAt).toBeNull();
  });

  it('does not set unverifiedExpiresAt for verified user', async () => {
    const user = {
      email: 'test@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: true,
      emailVerifiedAt: new Date('2026-04-01T00:00:00.000Z'),
      unverifiedExpiresAt: null,
    };
    await userRepository.save(user);
    await authService.forgotPassword({ email: user.email });
    const userAfter = await usersService.findByEmail(user.email);
    expect(userAfter?.unverifiedExpiresAt).toBeNull();
  });

  it('creates token and extends unverifiedExpiresAt for unverified user', async () => {
    const user = {
      email: 'test@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: false,
      unverifiedExpiresAt: new Date('2026-04-01T00:00:00.000Z'),
    };
    const userBefore = await userRepository.save(user);
    await authService.forgotPassword({ email: user.email });
    const token = await passwordResetTokensRepository.findOneBy({
      userId: userBefore.id,
    });

    expect(token).not.toBeNull();
    if (!token) {
      throw new Error('Expected password reset token to be created');
    }
    expect(token.userId).toBe(userBefore.id);
    expect(typeof token.jti).toBe('string');
    expect(token.jti.length).toBeGreaterThan(0);
    expect(typeof token.tokenHash).toBe('string');
    expect(token.tokenHash.length).toBeGreaterThan(0);
    expect(token.expiresAt).toBeInstanceOf(Date);
    expect(token.createdAt).toBeInstanceOf(Date);
    expect(token.usedAt).toBeNull();
    expect(token.revokedAt).toBeNull();

    const userAfter = await usersService.findByEmail(user.email);
    if (!userBefore?.unverifiedExpiresAt || !userAfter?.unverifiedExpiresAt) {
      throw new Error('Expected unverifiedExpiresAt to exist before and after');
    }
    expect(userBefore.unverifiedExpiresAt.getTime()).toBeLessThan(
      userAfter.unverifiedExpiresAt.getTime(),
    );
  });

  it('repeated forgot-password revokes previous active token', async () => {
    const user = {
      email: 'test@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: false,
      unverifiedExpiresAt: new Date('2026-04-01T00:00:00.000Z'),
    };
    const userRecord = await userRepository.save(user);
    await authService.forgotPassword({ email: user.email });
    await authService.forgotPassword({ email: user.email });
    const tokens = await passwordResetTokensRepository.find({
      where: { userId: userRecord.id },
      order: { createdAt: 'ASC' },
    });
    expect(tokens).toHaveLength(2);
    const [firstToken, secondToken] = tokens;
    expect(firstToken.revokedAt).toBeInstanceOf(Date);
    expect(secondToken.revokedAt).toBeNull();
    expect(secondToken.usedAt).toBeNull();
  });

  it('does not create password reset token for non-existing email', async () => {
    const email = 'non-existing@email.com';
    await authService.forgotPassword({ email });
    const tokensCount = await passwordResetTokensRepository.count();
    expect(tokensCount).toBe(0);
  });
});
