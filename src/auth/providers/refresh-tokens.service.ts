import {
  Injectable,
  UnauthorizedException,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RefreshToken } from '../entities/refresh-token.entity';
import { IsNull, MoreThan, Repository } from 'typeorm';
import {
  CreateRefreshTokenInput,
  RotateRefreshTokenInput,
} from '../interfaces/refresh-tokens.contract';
import {
  SECURE_HASHER,
  type SecureHasher,
} from '../interfaces/secure-hasher.interface';
import { RefreshTokenPayload } from '../interfaces/token-payloads.interface';
import { JwtTokensService } from './jwt-tokens.service';

@Injectable()
export class RefreshTokensService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly repo: Repository<RefreshToken>,
    @Inject(SECURE_HASHER)
    private readonly secureHasher: SecureHasher,
    private readonly jwtTokensService: JwtTokensService,
  ) {}

  private readonly logger = new Logger(RefreshTokensService.name);

  private async verifyRefreshPayloadOrThrow(
    token: string,
  ): Promise<RefreshTokenPayload> {
    try {
      return await this.jwtTokensService.verifyRefreshToken(token);
    } catch (_error) {
      this.logger.warn('Invalid refresh token');
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async validateRefreshTokenOrThrow(
    jti: string,
    token: string,
  ): Promise<RefreshToken> {
    const dbToken = await this.findByJti(jti);
    if (
      !dbToken ||
      Date.now() >= dbToken.expiresAt.getTime() ||
      dbToken.revokedAt !== null
    ) {
      this.logger.warn('Invalid refresh token');
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isValid = await this.secureHasher.verify(dbToken.tokenHash, token);
    if (!isValid) {
      this.logger.warn('Invalid refresh token');
      throw new UnauthorizedException('Invalid refresh token');
    }

    return dbToken;
  }

  async create(input: CreateRefreshTokenInput): Promise<RefreshToken> {
    const tokenHash = await this.secureHasher.hash(input.rawToken);
    const token = this.repo.create({
      tokenHash,
      jti: input.jti,
      userId: input.userId,
      expiresAt: input.expiresAt,
    });

    return await this.repo.save(token);
  }

  async validateOrThrow(token: string): Promise<RefreshToken> {
    const { jti } = await this.verifyRefreshPayloadOrThrow(token);
    const dbToken = await this.validateRefreshTokenOrThrow(jti, token);
    return dbToken;
  }

  async findByJti(jti: string): Promise<RefreshToken | null> {
    return this.repo.findOneBy({ jti });
  }

  async revoke(id: string): Promise<void> {
    const { affected } = await this.repo.update(id, { revokedAt: new Date() });
    if (affected === 0) {
      throw new Error('Failed to revoke refresh token');
    }
  }

  async rotate(input: RotateRefreshTokenInput): Promise<void> {
    const now = new Date();
    await this.repo.manager.transaction(async (manager) => {
      const txRepo = manager.getRepository(RefreshToken);
      const { affected } = await txRepo.update(
        {
          id: input.oldTokenId,
          revokedAt: IsNull(),
          expiresAt: MoreThan(now),
        },
        {
          revokedAt: now,
        },
      );

      if (affected !== 1) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const { newTokenInput } = input;
      const newTokenHash = await this.secureHasher.hash(newTokenInput.rawToken);
      const newTokenInsert = {
        tokenHash: newTokenHash,
        jti: newTokenInput.jti,
        userId: newTokenInput.userId,
        expiresAt: newTokenInput.expiresAt,
      };

      await txRepo.insert(newTokenInsert);
    });
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    await this.repo.update({ userId }, { revokedAt: new Date() });
  }
}
