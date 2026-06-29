import { ApiProperty } from '@nestjs/swagger';

export class RevokeOtherSessionsResponseDto {
  @ApiProperty({
    description: 'Operation result message',
    example: 'ok',
  })
  message: string;
}
