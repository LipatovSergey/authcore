import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LogoutAllRequestDto {
  @ApiProperty({
    description: 'Refresh token of the current session',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh-token',
  })
  @IsString()
  refresh_token: string;
}

export class LogoutAllResponseDto {
  @ApiProperty({
    description: 'Operation result message',
    example: 'ok',
  })
  message: string;
}
