import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RefreshToken } from '../entities/refresh-token.entity';
import { Repository } from 'typeorm';
import { CreateRefreshTokenInput } from '../interfaces/refresh-tokens.contract';

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly repo: Repository<RefreshToken>,
  ) {}

  async createToken(input: CreateRefreshTokenInput): Promise<RefreshToken> {
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
}
