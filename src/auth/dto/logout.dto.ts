import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LogoutRequestDto {
  @ApiPropertyOptional({
    description: 'Refresh token to revoke',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh-token',
  })
  @IsString()
  @IsOptional()
  refresh_token?: string;
}

export class LogoutResponseDto {
  @ApiProperty({
    description: 'Operation result message',
    example: 'ok',
  })
  message: string;
}
