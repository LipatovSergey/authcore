import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UsersService } from '../../users/users.service';

@Injectable()
export class UnverifiedUsersCleanupService {
  constructor(private readonly usersService: UsersService) {}
  private readonly logger = new Logger(UnverifiedUsersCleanupService.name);

  @Cron('0 0 3 * * *', {
    name: 'unverified-users-cleanup',
    timeZone: 'UTC',
    waitForCompletion: true,
  })
  async cleanup(): Promise<number> {
    this.logger.log('Unverified users cleanup job started');
    try {
      const now = new Date();
      const deletedUsersAmount =
        await this.usersService.cleanupUnverifiedUsers(now);
      this.logger.log(
        `Unverified users cleanup job completed, deleted ${deletedUsersAmount} users`,
      );
      return deletedUsersAmount;
    } catch (error) {
      this.logger.error('Unverified users cleanup job failed', error);
      throw error;
    }
  }
}
