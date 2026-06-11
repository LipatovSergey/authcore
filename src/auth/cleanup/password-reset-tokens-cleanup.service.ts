import { Injectable, Logger } from '@nestjs/common';
import { PasswordResetTokensService } from '../tokens/password-reset-tokens.service';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PasswordResetTokensCleanupService {
  constructor(
    private readonly passwordResetTokensService: PasswordResetTokensService,
    private readonly config: ConfigService,
  ) {}
  private readonly logger = new Logger(PasswordResetTokensCleanupService.name);

  @Cron('0 20 3 * * *', {
    name: 'password-reset-tokens-cleanup',
    timeZone: 'UTC',
    waitForCompletion: true,
  })
  async cleanup(): Promise<number> {
    this.logger.log('Stale password-reset-tokens cleanup job started');
    try {
      const cutoffMs =
        Date.now() -
        this.config.getOrThrow<number>('passwordResetTokenRetentionMs');
      const cutoffDate = new Date(cutoffMs);
      const deletedTokensAmount =
        await this.passwordResetTokensService.cleanupStaleTokens(cutoffDate);
      this.logger.log(
        `Stale password-reset-tokens cleanup job completed, deleted ${deletedTokensAmount} tokens.`,
      );
      return deletedTokensAmount;
    } catch (error) {
      this.logger.error(
        'Stale password-reset-tokens cleanup job failed',
        error,
      );
      throw error;
    }
  }
}
