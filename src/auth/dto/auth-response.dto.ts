import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
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

export class LogoutResponseDto {
  @ApiProperty({
    description: 'Operation result message',
    example: 'ok',
  })
  message: string;
}

export class LogoutAllResponseDto {
  @ApiProperty({
    description: 'Operation result message',
    example: 'ok',
  })
  message: string;
}

export class RegisterResponseDto {
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
  created_at: string;

  @ApiProperty({
    description: 'User last update timestamp',
    example: '2026-03-15T12:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  updated_at: string;
}

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
  created_at: string;

  @ApiProperty({
    description: 'User last update timestamp',
    example: '2026-03-15T12:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  updated_at: string;
}

export class UnauthorizedErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 401,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Error message',
    example: 'Invalid credentials',
  })
  message: string;

  @ApiProperty({
    description: 'Error type',
    example: 'Unauthorized',
  })
  error: string;
}

export class ConflictErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 409,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Error message',
    example: 'Email already exists',
  })
  message: string;

  @ApiProperty({
    description: 'Error type',
    example: 'Conflict',
  })
  error: string;
}

export class ValidationErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Validation error messages',
    example: [
      'email must be an email',
      'password must be longer than or equal to 12 characters',
    ],
    type: [String],
  })
  message: string[];

  @ApiProperty({
    description: 'Error type',
    example: 'Bad Request',
  })
  error: string;
}
