import { ApiProperty } from '@nestjs/swagger';

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
