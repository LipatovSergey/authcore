import { INestApplication } from '@nestjs/common';
import { DataSource, Repository, In } from 'typeorm';
import { createTestApp } from '../helpers/test-app.helper';
import { PasswordResetToken } from '../../src/auth/entities/password-reset-token.entity';
import { PasswordResetTokensService } from '../../src/auth/tokens/password-reset-tokens.service';
import { randomUUID } from 'crypto';
import { createUserFixture } from '../helpers/user-fixture.helper';

describe('PasswordResetTokensService.cleanupStaleTokens', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let passwordResetTokensRepository: Repository<PasswordResetToken>;
  let passwordResetTokensService: PasswordResetTokensService;

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    passwordResetTokensRepository =
      dataSource.getRepository(PasswordResetToken);
    passwordResetTokensService = app.get(PasswordResetTokensService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  async function createPasswordResetToken(data: {
    userId: string;
    expiresAt: Date;
    usedAt?: Date | null;
    revokedAt?: Date | null;
  }) {
    return passwordResetTokensRepository.save({
      userId: data.userId,
      jti: randomUUID(),
      tokenHash: `test-token-hash-${randomUUID()}`,
      expiresAt: data.expiresAt,
      usedAt: data.usedAt ?? null,
      revokedAt: data.revokedAt ?? null,
    });
  }

  it('deletes password reset tokens with usedAt before cutoff', async () => {
    const { id: userId } = await createUserFixture(dataSource);
    const cutoffMs = Date.parse('2026-06-01T00:00:00.000Z');
    const token = await createPasswordResetToken({
      userId,
      expiresAt: new Date(cutoffMs + ONE_DAY_MS),
      usedAt: new Date(cutoffMs - ONE_DAY_MS),
      revokedAt: null,
    });
    const cleanupResult = await passwordResetTokensService.cleanupStaleTokens(
      new Date(cutoffMs),
    );
    expect(cleanupResult).toBe(1);
    const findResult = await passwordResetTokensRepository.findOneBy({
      id: token.id,
    });
    expect(findResult).toBeNull();
  });

  it('deletes password reset tokens with revokedAt before cutoff', async () => {
    const { id: userId } = await createUserFixture(dataSource);
    const cutoffMs = Date.parse('2026-06-01T00:00:00.000Z');
    const token = await createPasswordResetToken({
      userId,
      expiresAt: new Date(cutoffMs + ONE_DAY_MS),
      usedAt: null,
      revokedAt: new Date(cutoffMs - ONE_DAY_MS),
    });
    const cleanupResult = await passwordResetTokensService.cleanupStaleTokens(
      new Date(cutoffMs),
    );
    expect(cleanupResult).toBe(1);
    const findResult = await passwordResetTokensRepository.findOneBy({
      id: token.id,
    });
    expect(findResult).toBeNull();
  });

  it('deletes password reset tokens with expiresAt before cutoff', async () => {
    const { id: userId } = await createUserFixture(dataSource);
    const cutoffMs = Date.parse('2026-06-01T00:00:00.000Z');
    const token = await createPasswordResetToken({
      userId,
      expiresAt: new Date(cutoffMs - ONE_DAY_MS),
      usedAt: null,
      revokedAt: null,
    });
    const cleanupResult = await passwordResetTokensService.cleanupStaleTokens(
      new Date(cutoffMs),
    );
    expect(cleanupResult).toBe(1);
    const findResult = await passwordResetTokensRepository.findOneBy({
      id: token.id,
    });
    expect(findResult).toBeNull();
  });

  it('keeps active non-expired tokens', async () => {
    const { id: userId } = await createUserFixture(dataSource);
    const cutoffMs = Date.parse('2026-06-01T00:00:00.000Z');
    const token = await createPasswordResetToken({
      userId,
      expiresAt: new Date(cutoffMs + ONE_DAY_MS),
      usedAt: null,
      revokedAt: null,
    });
    const cleanupResult = await passwordResetTokensService.cleanupStaleTokens(
      new Date(cutoffMs),
    );
    expect(cleanupResult).toBe(0);
    const findResult = await passwordResetTokensRepository.findOneBy({
      id: token.id,
    });
    expect(findResult).not.toBeNull();
  });

  it('keeps inactive tokens when cleanup timestamps are after cutoff', async () => {
    const { id: userId } = await createUserFixture(dataSource);
    const cutoffMs = Date.parse('2026-06-01T00:00:00.000Z');
    const usedAtAfterCutoffToken = await createPasswordResetToken({
      userId,
      expiresAt: new Date(cutoffMs + ONE_DAY_MS),
      usedAt: new Date(cutoffMs + ONE_DAY_MS),
      revokedAt: null,
    });
    const revokedAtAfterCutoffToken = await createPasswordResetToken({
      userId,
      expiresAt: new Date(cutoffMs + ONE_DAY_MS),
      usedAt: null,
      revokedAt: new Date(cutoffMs + ONE_DAY_MS),
    });
    const cleanupResult = await passwordResetTokensService.cleanupStaleTokens(
      new Date(cutoffMs),
    );
    expect(cleanupResult).toBe(0);
    const findResult = await passwordResetTokensRepository.findBy({
      id: In([usedAtAfterCutoffToken.id, revokedAtAfterCutoffToken.id]),
    });
    expect(findResult).toHaveLength(2);
  });
});
