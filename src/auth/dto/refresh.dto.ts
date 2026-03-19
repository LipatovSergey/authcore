import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RefreshRequestDto {
  @ApiProperty({
    description: 'Refresh token used to issue a new token pair',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh-token',
  })
  @IsString()
  refresh_token: string;
}

export class RefreshResponseDto {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access-token',
  })
  access_token: string;

  @ApiProperty({
    description: 'JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh-token',
  })
  refresh_token: string;
}
