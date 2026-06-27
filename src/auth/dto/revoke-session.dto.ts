import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SessionIdParamDto {
  @ApiProperty({
    description: 'Session Id',
    example: '6c8f7bb3-1b92-4e1b-91d1-8c4f39c2b4a1',
  })
  @IsUUID()
  id: string;
}

export class RevokeSessionResponseDto {
  @ApiProperty({
    description: 'Operation result message',
    example: 'ok',
  })
  message: string;
}
