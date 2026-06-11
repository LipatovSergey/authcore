import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EmailVerificationTokensService } from '../tokens/email-verification-tokens.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailVerificationTokensCleanupService {
  constructor(
    private readonly emailVerificationTokensService: EmailVerificationTokensService,
    private readonly config: ConfigService,
  ) {}
  private readonly logger = new Logger(
    EmailVerificationTokensCleanupService.name,
  );

  @Cron('0 10 3 * * *', {
    name: 'email-verification-tokens-cleanup',
    timeZone: 'UTC',
    waitForCompletion: true,
  })
  async cleanup(): Promise<number> {
    this.logger.log('Stale email-verification-tokens cleanup job started');
    try {
      const cutoffMs =
        Date.now() -
        this.config.getOrThrow<number>('emailVerificationTokenRetentionMs');
      const cutoffDate = new Date(cutoffMs);
      const deletedTokensAmount =
        await this.emailVerificationTokensService.cleanupStaleTokens(
          cutoffDate,
        );
      this.logger.log(
        `Stale email-verification-tokens cleanup job completed, deleted ${deletedTokensAmount} tokens.`,
      );
      return deletedTokensAmount;
    } catch (error) {
      this.logger.error(
        'Stale email-verification-tokens cleanup job failed',
        error,
      );
      throw error;
    }
  }
}
