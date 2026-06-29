import { DataSource } from 'typeorm';
import { EmailVerificationToken } from '../../src/auth/entities/email-verification-token.entity';
import { EmailVerificationTokensService } from '../../src/auth/tokens/email-verification-tokens.service';
import { JwtTokensService } from '../../src/auth/tokens/jwt-tokens.service';

type TokenStateOverrides = {
  usedAt?: Date | null;
  revokedAt?: Date | null;
  expiresAt?: Date;
};

type CreateEmailVerificationTokenFixtureParams = {
  dataSource: DataSource;
  jwtTokensService: JwtTokensService;
  emailVerificationTokensService: EmailVerificationTokensService;
  userId: string;
  overrides?: TokenStateOverrides;
};

export async function createEmailVerificationTokenFixture(
  params: CreateEmailVerificationTokenFixtureParams,
) {
  const {
    dataSource,
    jwtTokensService,
    emailVerificationTokensService,
    userId,
    overrides,
  } = params;

  const issuedToken = await jwtTokensService.signEmailVerificationToken(userId);

  await dataSource.transaction(async (manager) => {
    await emailVerificationTokensService.setActiveTokenWithManager(
      {
        ...issuedToken,
        userId,
      },
      manager,
    );
  });

  const repo = dataSource.getRepository(EmailVerificationToken);
  const token = await repo.findOneBy({ jti: issuedToken.jti });
  if (!token) {
    throw new Error('Expected email verification token to be created');
  }

  if (overrides) {
    await repo.update(token.id, {
      usedAt: overrides.usedAt ?? token.usedAt,
      revokedAt: overrides.revokedAt ?? token.revokedAt,
      expiresAt: overrides.expiresAt ?? token.expiresAt,
    });
  }

  const tokenAfter = await repo.findOneBy({ id: token.id });
  if (!tokenAfter) {
    throw new Error('Expected email verification token to exist after update');
  }

  return {
    rawToken: issuedToken.rawToken,
    token: tokenAfter,
  };
}
