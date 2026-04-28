import { Controller, Delete, Get, NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ConfigService } from '@nestjs/config';
import {
  ApiClearNotificationsOutboxEndpoint,
  ApiGetNotificationsOutboxEndpoint,
  ApiNotificationsOutboxController,
} from './notifications-swagger.decorators';

@ApiNotificationsOutboxController()
@Controller('demo/notifications-outbox')
export class NotificationsOutboxController {
  private readonly demoNotificationsOutboxEnabled: boolean;
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly config: ConfigService,
  ) {
    this.demoNotificationsOutboxEnabled = this.config.getOrThrow<boolean>(
      'demoNotificationsOutboxEnabled',
    );
  }

  private ensureDemoNotificationsOutboxEnabled(): void {
    if (!this.demoNotificationsOutboxEnabled) {
      throw new NotFoundException();
    }
  }

  @Get()
  @ApiGetNotificationsOutboxEndpoint()
  getOutboxMessages() {
    this.ensureDemoNotificationsOutboxEnabled();
    return { messages: this.notificationsService.getOutboxMessages() };
  }

  @Delete()
  @ApiClearNotificationsOutboxEndpoint()
  clearOutbox() {
    this.ensureDemoNotificationsOutboxEnabled();
    this.notificationsService.clearOutbox();
    return { message: 'ok' };
  }
}
