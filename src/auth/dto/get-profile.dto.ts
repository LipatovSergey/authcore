import { ApiProperty } from '@nestjs/swagger';

export class GetProfileResponseDto {
  @ApiProperty({
    description: 'User unique identifier',
    example: '6c8f7bb3-1b92-4e1b-91d1-8c4f39c2b4a1',
  })
  id: string;

  @ApiProperty({
    description: 'User email address',
    example: 'tester@gmail.com',
  })
  email: string;

  @ApiProperty({
    description: 'User creation timestamp',
    example: '2026-03-15T12:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  created_at: Date;

  @ApiProperty({
    description: 'User last update timestamp',
    example: '2026-03-15T12:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  updated_at: Date;
}
