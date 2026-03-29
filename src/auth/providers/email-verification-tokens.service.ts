import {
  Injectable,
  Inject,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EmailVerificationToken } from '../entities/email-verification-token.entity';
import {
  SECURE_HASHER,
  type SecureHasher,
} from '../interfaces/secure-hasher.interface';
import { IsNull, Repository } from 'typeorm';
import { CreateEmailVerificationTokenInput } from '../types/email-verification-tokens';
import { JwtTokensService } from './jwt-tokens.service';
import { EmailVerificationTokenPayload } from '../types/jwt-tokens';

@Injectable()
export class EmailVerificationTokensService {
  constructor(
    @InjectRepository(EmailVerificationToken)
    private readonly repo: Repository<EmailVerificationToken>,
    @Inject(SECURE_HASHER)
    private readonly secureHasher: SecureHasher,
    private readonly jwtTokenService: JwtTokensService,
  ) {}

  private readonly logger = new Logger(EmailVerificationTokensService.name);

  private async verifyPayloadOrThrow(
    rawToken: string,
  ): Promise<EmailVerificationTokenPayload> {
    try {
      return this.jwtTokenService.verifyEmailVerificationToken(rawToken);
    } catch (_error) {
      this.logger.warn('Invalid email verification token');
      throw new UnauthorizedException('Invalid email verification token');
    }
  }

  private async findByJti(jti: string): Promise<EmailVerificationToken | null> {
    return this.repo.findOneBy({ jti });
  }

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

  async validateOrThrow(rawToken: string) {
    // verify token via jwtTokenService and get payload
    const { jti } = await this.verifyPayloadOrThrow(rawToken);
    // find token in DB with jti from payload
    const tokenInstance = await this.findByJti(jti);
    // check if usedAt === null, revokedAt === null, expiresAt > now
    if (
      !tokenInstance ||
      Date.now() >= tokenInstance.expiresAt.getTime() ||
      tokenInstance.usedAt !== null ||
      tokenInstance.revokedAt !== null
    ) {
      this.logger.warn('Invalid email verification token');
      throw new UnauthorizedException('Invalid email verification token');
    }
    // verify token via hasher
    const isValid = await this.secureHasher.verify(
      tokenInstance.tokenHash,
      rawToken,
    );
    if (!isValid) {
      this.logger.warn('Invalid email verification token');
      throw new UnauthorizedException('Invalid email verification token');
    }

    return tokenInstance;
  }
}
