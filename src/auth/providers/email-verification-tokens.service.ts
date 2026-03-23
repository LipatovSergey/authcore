import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EmailVerificationToken } from '../entities/email-verification-token.entity';
import {
  SECURE_HASHER,
  type SecureHasher,
} from '../interfaces/secure-hasher.interface';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';

@Injectable()
export class EmailVerificationTokensService {
  constructor(
    @InjectRepository(EmailVerificationToken)
    private readonly repo: Repository<EmailVerificationToken>,
    @Inject(SECURE_HASHER)
    private readonly secureHasher: SecureHasher,
    private readonly config: ConfigService,
  ) {}

  async create(userId: string) {
    const now = new Date();
    const ttlMs = this.config.getOrThrow<number>(
      'emailVerificationToken.ttlMs',
    );
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = await this.secureHasher.hash(rawToken);
    const expiresAt = new Date(now.getTime() + ttlMs);
    const tokenRecord = this.repo.create({
      tokenHash,
      userId,
      expiresAt,
    });

    await this.repo.manager.transaction(async (manager) => {
      const txRepo = manager.getRepository(EmailVerificationToken);
      await txRepo.update(
        { userId, revokedAt: IsNull(), usedAt: IsNull() },
        { revokedAt: now },
      );
      await txRepo.save(tokenRecord);
    });

    return rawToken;
  }
}
