import { ApiProperty } from '@nestjs/swagger';

export class AuthSessionDto {
  @ApiProperty({
    description: 'Session unique identifier',
    example: '6c8f7bb3-1b92-4e1b-91d1-8c4f39c2b4a1',
  })
  id: string;

  @ApiProperty({
    description: 'Raw user agent string',
    example: null,
  })
  browser: string;

  @ApiProperty({
    description: 'Raw user agent string',
    example: null,
  })
  os: string;

  @ApiProperty({
    description: 'Raw user agent string',
    example: null,
  })
  device: string;

  @ApiProperty({
    description: 'Session IP address',
    example: null,
    nullable: true,
  })
  ip_address: string | null;

  @ApiProperty({
    description: 'Session creation timestamp',
    example: '2026-03-15T12:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Session last refresh timestamp',
    example: '2026-03-15T12:00:00.000Z',
    type: String,
    format: 'date-time',
    nullable: true,
  })
  last_refreshed_at: Date | null;
}

export class GetSessionsResponseDto {
  @ApiProperty({
    description: 'Active auth sessions',
    type: [AuthSessionDto],
  })
  sessions: AuthSessionDto[];
}
