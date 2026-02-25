import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { RefreshTokenPayload } from '../interfaces/token-payloads.interface';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signAccessToken(payload: { sub: string; email: string }) {
    return this.jwtService.signAsync(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>(
        'jwt.accessExpiresIn',
      ) as JwtSignOptions['expiresIn'],
    });
  }

  async signRefreshToken(sub: string) {
    const jti = randomUUID();
    const payload: RefreshTokenPayload = { sub, jti };
    const token = await this.jwtService.signAsync(payload, {
      secret: this.config.get<string>('jwt.refreshSecret'),
      expiresIn: this.config.get<string>(
        'jwt.refreshExpiresIn',
      ) as JwtSignOptions['expiresIn'],
    });
    return { token, jti };
  }

  async verifyRefreshToken(token: string) {
    return this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
      secret: this.config.get<string>('jwt.refreshSecret'),
    });
  }
}
