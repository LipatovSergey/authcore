import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LogoutAllRequestDto {
  @ApiPropertyOptional({
    description: 'Refresh token of the current session',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh-token',
  })
  @IsOptional()
  @IsString()
  refresh_token?: string;
}

export class LogoutAllResponseDto {
  @ApiProperty({
    description: 'Operation result message',
    example: 'ok',
  })
  message: string;
}
