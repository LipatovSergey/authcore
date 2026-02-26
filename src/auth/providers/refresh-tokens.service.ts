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

  async create(input: CreateRefreshTokenInput) {
    const token = this.repo.create({
      tokenHash: input.tokenHash,
      jti: input.jti,
      userId: input.userId,
    });

    return await this.repo.save(token);
  }
}
