import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class EmailVerificationResendRequestDto {
  @ApiProperty({
    description: 'User email address',
    example: 'tester@gmail.com',
  })
  @IsEmail()
  email: string;
}

export class EmailVerificationResendResponseDto {
  @ApiProperty({
    description: 'Operation result message',
    example: 'ok',
  })
  message: string;
}
