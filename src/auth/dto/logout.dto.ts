import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LogoutRequestDto {
  @ApiProperty({
    description: 'Refresh token to revoke',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh-token',
  })
  @IsString()
  refresh_token: string;
}

export class LogoutResponseDto {
  @ApiProperty({
    description: 'Operation result message',
    example: 'ok',
  })
  message: string;
}
