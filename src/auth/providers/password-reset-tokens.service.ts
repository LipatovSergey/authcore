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
import { IsNull, Repository } from 'typeorm';
import { CreatePasswordResetTokenInput } from '../types/password-reset-tokens';
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
      return this.jwtTokenService.verifyPasswordResetToken(rawToken);
    } catch (_error) {
      this.logger.warn('Invalid password reset token');
      throw new UnauthorizedException('Invalid password reset token');
    }
  }

  private async findByJti(jti: string): Promise<PasswordResetToken | null> {
    return this.repo.findOneBy({ jti });
  }

  async create(input: CreatePasswordResetTokenInput): Promise<void> {
    const { rawToken, jti, userId, expiresAt } = input;
    const tokenHash = await this.secureHasher.hash(rawToken);
    const tokenRecord = this.repo.create({
      tokenHash,
      jti,
      userId,
      expiresAt,
    });

    // save new token and revoke all unused tokens
    await this.repo.manager.transaction(async (manager) => {
      const txRepo = manager.getRepository(PasswordResetToken);
      await txRepo.update(
        { userId, revokedAt: IsNull(), usedAt: IsNull() },
        { revokedAt: new Date() },
      );
      await txRepo.save(tokenRecord);
    });
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
