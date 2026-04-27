import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordRequestDto {
  @ApiProperty({
    description: 'password reset token',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  token: string;

  @ApiProperty({
    description: 'User password',
    example: 'some spaced text',
    minLength: 12,
  })
  @IsString()
  @MinLength(12)
  password: string;
}

export class ResetPasswordResponseDto {
  @ApiProperty({
    description: 'Operation result message',
    example: 'ok',
  })
  message: string;
}
