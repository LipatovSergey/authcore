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

  private async verifyPayloadOrThrow(
    rawToken: string,
  ): Promise<RefreshTokenPayload> {
    try {
      return await this.jwtTokensService.verifyRefreshToken(rawToken);
    } catch (_error) {
      this.logger.warn('Refresh token verification failed');
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async loadTokenRecordOrThrow(jti: string): Promise<RefreshToken> {
    if (typeof jti !== 'string' || jti.length === 0) {
      this.logger.warn('Refresh token identifier is invalid');
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenInstance = await this.findByJti(jti);
    if (!tokenInstance) {
      this.logger.warn('Refresh token record not found');
      throw new UnauthorizedException('Invalid refresh token');
    }

    return tokenInstance;
  }

  private async validateTokenRecordOrThrow(input: {
    tokenPayload: RefreshTokenPayload;
    tokenInstance: RefreshToken;
    rawToken: string;
  }): Promise<void> {
    const { tokenPayload, tokenInstance, rawToken } = input;

    if (Date.now() >= tokenInstance.expiresAt.getTime()) {
      this.logger.warn('Expired refresh token rejected');
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (tokenPayload.sub !== tokenInstance.userId) {
      this.logger.error('Refresh token subject does not match persisted owner');
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (tokenPayload.sid !== tokenInstance.sessionId) {
      this.logger.error(
        'Refresh token session does not match persisted session',
      );
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isValid = await this.secureHasher.verify(
      tokenInstance.tokenHash,
      rawToken,
    );
    if (!isValid) {
      this.logger.warn('Refresh token hash verification failed');
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (tokenInstance.revokedAt !== null) {
      this.logger.warn('Revoked refresh token presented');
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async authenticateTokenOrThrow(rawToken: string): Promise<RefreshToken> {
    const tokenPayload = await this.verifyPayloadOrThrow(rawToken);
    const tokenInstance = await this.loadTokenRecordOrThrow(tokenPayload.jti);
    await this.validateTokenRecordOrThrow({
      tokenPayload,
      tokenInstance,
      rawToken,
    });
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
    const txRepo = manager.getRepository(RefreshToken);
    const { affected } = await txRepo.update(
      {
        id: input.oldTokenId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(input.rotatedAt),
      },
      {
        revokedAt: input.rotatedAt,
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
