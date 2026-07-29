import { ApiProperty } from '@nestjs/swagger';

export class LogoutAllResponseDto {
  @ApiProperty({
    description: 'Operation result message',
    example: 'ok',
  })
  message: string;
}
