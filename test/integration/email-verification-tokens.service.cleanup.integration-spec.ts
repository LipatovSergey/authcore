import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { DataSource, Repository, In } from 'typeorm';
import { EmailVerificationToken } from '../../src/auth/entities/email-verification-token.entity';
import { createTestApp } from '../helpers/test-app.helper';
import { randomUUID } from 'crypto';
import { EmailVerificationTokensService } from '../../src/auth/tokens/email-verification-tokens.service';
import { createUserFixture } from '../helpers/user-fixture.helper';

describe('EmailVerificationTokensService.cleanupStaleTokens', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let emailVerificationTokensRepository: Repository<EmailVerificationToken>;
  let emailVerificationTokensService: EmailVerificationTokensService;

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    emailVerificationTokensRepository = dataSource.getRepository(
      EmailVerificationToken,
    );
    emailVerificationTokensService = app.get(EmailVerificationTokensService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  async function createEmailVerificationToken(data: {
    userId: string;
    expiresAt: Date;
    usedAt?: Date | null;
    revokedAt?: Date | null;
  }) {
    return emailVerificationTokensRepository.save({
      userId: data.userId,
      jti: randomUUID(),
      tokenHash: `test-token-hash-${randomUUID()}`,
      expiresAt: data.expiresAt,
      usedAt: data.usedAt ?? null,
      revokedAt: data.revokedAt ?? null,
    });
  }

  it('deletes email verification tokens with usedAt before cutoff', async () => {
    const { id: userId } = await createUserFixture(dataSource);
    const cutoffMs = Date.parse('2026-06-01T00:00:00.000Z');
    const token = await createEmailVerificationToken({
      userId,
      expiresAt: new Date(cutoffMs + ONE_DAY_MS),
      usedAt: new Date(cutoffMs - ONE_DAY_MS),
      revokedAt: null,
    });
    const cleanupResult =
      await emailVerificationTokensService.cleanupStaleTokens(
        new Date(cutoffMs),
      );
    expect(cleanupResult).toBe(1);
    const findResult = await emailVerificationTokensRepository.findOneBy({
      id: token.id,
    });
    expect(findResult).toBeNull();
  });

  it('deletes email verification tokens with revokedAt before cutoff', async () => {
    const { id: userId } = await createUserFixture(dataSource);
    const cutoffMs = Date.parse('2026-06-01T00:00:00.000Z');
    const token = await createEmailVerificationToken({
      userId,
      expiresAt: new Date(cutoffMs + ONE_DAY_MS),
      usedAt: null,
      revokedAt: new Date(cutoffMs - ONE_DAY_MS),
    });
    const cleanupResult =
      await emailVerificationTokensService.cleanupStaleTokens(
        new Date(cutoffMs),
      );
    expect(cleanupResult).toBe(1);
    const findResult = await emailVerificationTokensRepository.findOneBy({
      id: token.id,
    });
    expect(findResult).toBeNull();
  });

  it('deletes email verification tokens with expiresAt before cutoff', async () => {
    const { id: userId } = await createUserFixture(dataSource);
    const cutoffMs = Date.parse('2026-06-01T00:00:00.000Z');
    const token = await createEmailVerificationToken({
      userId,
      expiresAt: new Date(cutoffMs - ONE_DAY_MS),
      usedAt: null,
      revokedAt: null,
    });
    const cleanupResult =
      await emailVerificationTokensService.cleanupStaleTokens(
        new Date(cutoffMs),
      );
    expect(cleanupResult).toBe(1);
    const findResult = await emailVerificationTokensRepository.findOneBy({
      id: token.id,
    });
    expect(findResult).toBeNull();
  });

  it('keeps active non-expired tokens', async () => {
    const { id: userId } = await createUserFixture(dataSource);
    const cutoffMs = Date.parse('2026-06-01T00:00:00.000Z');
    const token = await createEmailVerificationToken({
      userId,
      expiresAt: new Date(cutoffMs + ONE_DAY_MS),
      usedAt: null,
      revokedAt: null,
    });
    const cleanupResult =
      await emailVerificationTokensService.cleanupStaleTokens(
        new Date(cutoffMs),
      );
    expect(cleanupResult).toBe(0);
    const findResult = await emailVerificationTokensRepository.findOneBy({
      id: token.id,
    });
    expect(findResult).not.toBeNull();
  });

  it('keeps inactive tokens when cleanup timestamps are after cutoff', async () => {
    const { id: userId } = await createUserFixture(dataSource);
    const cutoffMs = Date.parse('2026-06-01T00:00:00.000Z');
    const usedAtAfterCutoffToken = await createEmailVerificationToken({
      userId,
      expiresAt: new Date(cutoffMs + ONE_DAY_MS),
      usedAt: new Date(cutoffMs + ONE_DAY_MS),
      revokedAt: null,
    });
    const revokedAtAfterCutoffToken = await createEmailVerificationToken({
      userId,
      expiresAt: new Date(cutoffMs + ONE_DAY_MS),
      usedAt: null,
      revokedAt: new Date(cutoffMs + ONE_DAY_MS),
    });
    const cleanupResult =
      await emailVerificationTokensService.cleanupStaleTokens(
        new Date(cutoffMs),
      );
    expect(cleanupResult).toBe(0);
    const findResult = await emailVerificationTokensRepository.findBy({
      id: In([usedAtAfterCutoffToken.id, revokedAtAfterCutoffToken.id]),
    });
    expect(findResult).toHaveLength(2);
  });
});
