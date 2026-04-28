import { applyDecorators } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

export function ApiNotificationsOutboxController() {
  return applyDecorators(ApiTags('demo notifications'));
}

export function ApiGetNotificationsOutboxEndpoint() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get demo notifications outbox',
      description:
        'Returns in-memory demo notification messages. Available only when demo notifications outbox is enabled.',
    }),
    ApiOkResponse({
      description: 'Demo notifications outbox returned successfully',
    }),
    ApiNotFoundResponse({
      description: 'Demo notifications outbox is disabled',
    }),
  );
}

export function ApiClearNotificationsOutboxEndpoint() {
  return applyDecorators(
    ApiOperation({
      summary: 'Clear demo notifications outbox',
      description:
        'Clears in-memory demo notification messages. Available only when demo notifications outbox is enabled.',
    }),
    ApiOkResponse({
      description: 'Demo notifications outbox cleared successfully',
    }),
    ApiNotFoundResponse({
      description: 'Demo notifications outbox is disabled',
    }),
  );
}
