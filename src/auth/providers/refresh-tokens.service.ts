import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RefreshToken } from '../entities/refresh-token.entity';
import { IsNull, MoreThan, Repository } from 'typeorm';
import {
  CreateRefreshTokenInput,
  RotateRefreshTokenInput,
} from '../interfaces/refresh-tokens.contract';

@Injectable()
export class RefreshTokensService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly repo: Repository<RefreshToken>,
  ) {}

  async create(input: CreateRefreshTokenInput): Promise<RefreshToken> {
    const token = this.repo.create({
      tokenHash: input.tokenHash,
      jti: input.jti,
      userId: input.userId,
      expiresAt: input.expiresAt,
    });

    return await this.repo.save(token);
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

      await txRepo.insert(input.newTokenInput);
    });
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    await this.repo.update({ userId }, { revokedAt: new Date() });
  }
}
