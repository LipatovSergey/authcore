import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EmailVerificationToken } from '../entities/email-verification-token.entity';
import {
  SECURE_HASHER,
  type SecureHasher,
} from '../interfaces/secure-hasher.interface';
import { IsNull, Repository } from 'typeorm';
import { CreateEmailVerificationTokenInput } from '../types/email-verification-tokens';

@Injectable()
export class EmailVerificationTokensService {
  constructor(
    @InjectRepository(EmailVerificationToken)
    private readonly repo: Repository<EmailVerificationToken>,
    @Inject(SECURE_HASHER)
    private readonly secureHasher: SecureHasher,
  ) {}

  async create(input: CreateEmailVerificationTokenInput): Promise<void> {
    const { rawToken, jti, userId, expiresAt } = input;
    const tokenHash = await this.secureHasher.hash(rawToken);
    const tokenRecord = this.repo.create({
      tokenHash,
      jti,
      userId,
      expiresAt,
    });

    await this.repo.manager.transaction(async (manager) => {
      const txRepo = manager.getRepository(EmailVerificationToken);
      await txRepo.update(
        { userId, revokedAt: IsNull(), usedAt: IsNull() },
        { revokedAt: new Date() },
      );
      await txRepo.save(tokenRecord);
    });
  }
}
