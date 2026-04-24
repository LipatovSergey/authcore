import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterRequestDto {
  @ApiProperty({
    description: 'User email address',
    example: 'tester@gmail.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'some spaced text',
    minLength: 12,
  })
  @IsString()
  @MinLength(12)
  password: string;
}

export class RegisterResponseDto {
  @ApiProperty({
    description: 'Operation result message',
    example: 'ok',
  })
  message: string;
}
