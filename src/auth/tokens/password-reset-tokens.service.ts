import {
  Injectable,
  Inject,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import {
  SECURE_HASHER,
  type SecureHasher,
} from '../interfaces/secure-hasher.interface';
import { EntityManager, IsNull, Repository } from 'typeorm';
import {
  CreatePasswordResetTokenInput,
  MarkTokenAsUsedInput,
} from '../types/password-reset-tokens';
import { JwtTokensService } from './jwt-tokens.service';
import { PasswordResetTokenPayload } from '../types/jwt-tokens';

@Injectable()
export class PasswordResetTokensService {
  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly repo: Repository<PasswordResetToken>,
    @Inject(SECURE_HASHER)
    private readonly secureHasher: SecureHasher,
    private readonly jwtTokenService: JwtTokensService,
  ) {}

  private readonly logger = new Logger(PasswordResetTokensService.name);

  private async verifyPayloadOrThrow(
    rawToken: string,
  ): Promise<PasswordResetTokenPayload> {
    try {
      return await this.jwtTokenService.verifyPasswordResetToken(rawToken);
    } catch (_error) {
      this.logger.warn('Invalid password reset token');
      throw new UnauthorizedException('Invalid password reset token');
    }
  }

  private async findByJti(jti: string): Promise<PasswordResetToken | null> {
    return this.repo.findOneBy({ jti });
  }

  async markTokenAsUsedWithManager(
    input: MarkTokenAsUsedInput,
    manager: EntityManager,
  ): Promise<void> {
    const { id, now } = input;
    const repo = manager.getRepository(PasswordResetToken);
    const { affected } = await repo.update(id, { usedAt: now });
    if (affected !== 1) {
      throw new Error(
        'Failed to mark password reset token as used: token was not updated',
      );
    }
  }

  async setActiveTokenWithManager(
    input: CreatePasswordResetTokenInput,
    manager: EntityManager,
  ) {
    const { rawToken, jti, userId, expiresAt } = input;
    const tokenHash = await this.secureHasher.hash(rawToken);
    const repo = manager.getRepository(PasswordResetToken);

    await repo.update(
      { userId, revokedAt: IsNull(), usedAt: IsNull() },
      { revokedAt: new Date() },
    );

    const tokenRecord = repo.create({
      tokenHash,
      jti,
      userId,
      expiresAt,
    });

    await repo.save(tokenRecord);
  }

  async validateOrThrow(rawToken: string) {
    const { jti } = await this.verifyPayloadOrThrow(rawToken);
    const tokenInstance = await this.findByJti(jti);
    if (
      !tokenInstance ||
      Date.now() >= tokenInstance.expiresAt.getTime() ||
      tokenInstance.usedAt !== null ||
      tokenInstance.revokedAt !== null
    ) {
      this.logger.warn('Invalid password reset token');
      throw new UnauthorizedException('Invalid password reset token');
    }
    // verify token via hasher
    const isValid = await this.secureHasher.verify(
      tokenInstance.tokenHash,
      rawToken,
    );
    if (!isValid) {
      this.logger.warn('Invalid password reset token');
      throw new UnauthorizedException('Invalid password reset token');
    }

    return tokenInstance;
  }
}
