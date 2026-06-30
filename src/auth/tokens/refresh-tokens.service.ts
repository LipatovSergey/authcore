import {
  Injectable,
  UnauthorizedException,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RefreshToken } from '../entities/refresh-token.entity';
import {
  EntityManager,
  IsNull,
  LessThan,
  MoreThan,
  Not,
  Repository,
} from 'typeorm';
import {
  CreateRefreshTokenInput,
  RevokeAllUserRefreshTokensInput,
  RevokeOtherUserRefreshTokensInput,
  RevokeRefreshTokensBySessionInput,
  RotateRefreshTokenInput,
} from '../types/refresh-tokens';
import {
  SECURE_HASHER,
  type SecureHasher,
} from '../interfaces/secure-hasher.interface';
import type { RefreshTokenPayload } from '../types/jwt-tokens';
import { JwtTokensService } from './jwt-tokens.service';
import { RefreshTokenReuseDetectedError } from './refresh-token-reuse-detected.error';

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

  private async verifyAndLoadTokenOrThrow(
    jti: string,
    token: string,
  ): Promise<RefreshToken> {
    const tokenInstance = await this.findByJti(jti);
    if (!tokenInstance || Date.now() >= tokenInstance.expiresAt.getTime()) {
      this.logger.warn('Invalid refresh token');
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isValid = await this.secureHasher.verify(
      tokenInstance.tokenHash,
      token,
    );
    if (!isValid) {
      this.logger.warn('Invalid refresh token');
      throw new UnauthorizedException('Invalid refresh token');
    }

    return tokenInstance;
  }

  async create(
    input: CreateRefreshTokenInput,
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(RefreshToken);
    const tokenHash = await this.secureHasher.hash(input.rawToken);
    const token = repo.create({
      tokenHash,
      jti: input.jti,
      userId: input.userId,
      sessionId: input.sessionId,
      expiresAt: input.expiresAt,
    });

    await repo.save(token);
  }

  async verifyForRevocationOrThrow(token: string): Promise<RefreshToken> {
    const { jti } = await this.verifyRefreshPayloadOrThrow(token);
    const tokenInstance = await this.verifyAndLoadTokenOrThrow(jti, token);
    return tokenInstance;
  }

  async validateActiveForRotationOrThrow(token: string): Promise<RefreshToken> {
    const { jti } = await this.verifyRefreshPayloadOrThrow(token);
    const tokenInstance = await this.verifyAndLoadTokenOrThrow(jti, token);

    // Known revoked token with a matching hash means possible refresh token reuse
    if (tokenInstance.revokedAt !== null) {
      this.logger.warn(
        `Refresh token reuse detected: userId=${tokenInstance.userId}`,
      );
      throw new RefreshTokenReuseDetectedError(tokenInstance.userId);
    }
    return tokenInstance;
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

  async revokeAllBySessionId(
    input: RevokeRefreshTokensBySessionInput,
    manager: EntityManager,
  ) {
    const { sessionId, revokedAt } = input;
    const repo = manager.getRepository(RefreshToken);
    const { affected } = await repo.update(
      { sessionId, revokedAt: IsNull() },
      { revokedAt: revokedAt },
    );

    return affected ?? 0;
  }

  async revokeAllByUserIdExceptSessionId(
    input: RevokeOtherUserRefreshTokensInput,
    manager: EntityManager,
  ) {
    const { userId, currentSessionId, revokedAt } = input;
    const repo = manager.getRepository(RefreshToken);
    const { affected } = await repo.update(
      { userId, sessionId: Not(currentSessionId), revokedAt: IsNull() },
      { revokedAt: revokedAt },
    );

    return affected ?? 0;
  }
  async rotate(
    input: RotateRefreshTokenInput,
    manager: EntityManager,
  ): Promise<void> {
    const now = new Date();
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
      sessionId: newTokenInput.sessionId,
    };

    await txRepo.insert(newTokenInsert);
  }

  async revokeAllByUserId(
    input: RevokeAllUserRefreshTokensInput,
    manager: EntityManager,
  ) {
    const { userId, revokedAt } = input;
    const repo = manager.getRepository(RefreshToken);
    const { affected } = await repo.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: revokedAt },
    );
    return affected ?? 0;
  }

  async cleanupStaleTokens(cutoff: Date): Promise<number> {
    // TypeORM treats an array of criteria as OR conditions.
    const { affected } = await this.repo.delete([
      { expiresAt: LessThan(cutoff) },
      { revokedAt: LessThan(cutoff) },
    ]);
    if (affected === undefined || affected === null) {
      throw new Error('Failed to determine how many stale tokens were deleted');
    }
    return affected;
  }
}
