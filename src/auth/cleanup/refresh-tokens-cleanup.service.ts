import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { RefreshTokensService } from '../tokens/refresh-tokens.service';

@Injectable()
export class RefreshTokensCleanupService {
  constructor(
    private readonly refreshTokensService: RefreshTokensService,
    private readonly config: ConfigService,
  ) {}
  private readonly logger = new Logger(RefreshTokensCleanupService.name);

  @Cron('0 30 3 * * *', {
    name: 'refresh-tokens-cleanup',
    timeZone: 'UTC',
    waitForCompletion: true,
  })
  async cleanup(): Promise<number> {
    this.logger.log('Stale refresh-tokens cleanup job started');
    try {
      const cutoffMs =
        Date.now() - this.config.getOrThrow<number>('refreshTokenRetentionMs');
      const cutoffDate = new Date(cutoffMs);
      const deletedTokensAmount =
        await this.refreshTokensService.cleanupStaleTokens(cutoffDate);
      this.logger.log(
        `Stale refresh-tokens cleanup job completed, deleted ${deletedTokensAmount} tokens.`,
      );
      return deletedTokensAmount;
    } catch (error) {
      this.logger.error('Stale refresh-tokens cleanup job failed', error);
      throw error;
    }
  }
}
