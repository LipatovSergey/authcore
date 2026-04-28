import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsOutboxController } from './notifications-outbox.controller';

@Module({
  providers: [NotificationsService],
  controllers: [NotificationsOutboxController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
