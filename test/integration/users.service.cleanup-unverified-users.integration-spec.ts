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
});
