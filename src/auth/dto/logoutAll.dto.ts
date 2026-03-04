import { IsString } from 'class-validator';

export class LogoutAllDto {
  @IsString()
  refresh_token: string;
}
