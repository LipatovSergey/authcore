import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
  EmailVerificationTokenPayload,
  IssuedRefreshToken,
  PasswordResetTokenPayload,
} from '../types/jwt-tokens';

type DecodedWithExp = {
  exp: number;
};

function hasNumericExp(value: unknown): value is DecodedWithExp {
  if (typeof value !== 'object' || value === null) return false;
  if (!Object.prototype.hasOwnProperty.call(value, 'exp')) return false;

  const exp = (value as Record<string, unknown>)['exp'];
  return typeof exp === 'number';
}

@Injectable()
export class JwtTokensService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signAccessToken(payload: AccessTokenPayload) {
    return this.jwtService.signAsync(payload, {
      secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      expiresIn: this.config.getOrThrow<string>(
        'jwt.accessExpiresIn',
      ) as JwtSignOptions['expiresIn'],
    });
  }

  async signEmailVerificationToken(sub: string) {
    const jti = randomUUID();
    const payload = { sub, jti };
    const rawToken = await this.jwtService.signAsync(payload, {
      secret: this.config.getOrThrow<string>('jwt.emailVerificationSecret'),
      expiresIn: this.config.getOrThrow<string>(
        'jwt.emailVerificationExpiresIn',
      ) as JwtSignOptions['expiresIn'],
    });
    const decoded: unknown = this.jwtService.decode(rawToken);
    if (!hasNumericExp(decoded)) {
      throw new Error('Failed to decode email verification token');
    }
    const expiresAt = new Date(decoded.exp * 1000);
    return { rawToken, jti, expiresAt };
  }

  async verifyEmailVerificationToken(token: string) {
    return this.jwtService.verifyAsync<EmailVerificationTokenPayload>(token, {
      secret: this.config.getOrThrow<string>('jwt.emailVerificationSecret'),
    });
  }

  async signPasswordResetToken(sub: string) {
    const jti = randomUUID();
    const payload = { sub, jti };
    const rawToken = await this.jwtService.signAsync(payload, {
      secret: this.config.getOrThrow<string>('jwt.passwordResetSecret'),
      expiresIn: this.config.getOrThrow<string>(
        'jwt.passwordResetExpiresIn',
      ) as JwtSignOptions['expiresIn'],
    });
    const decoded: unknown = this.jwtService.decode(rawToken);
    if (!hasNumericExp(decoded)) {
      throw new Error('Failed to decode password reset token');
    }
    const expiresAt = new Date(decoded.exp * 1000);
    return { rawToken, jti, expiresAt };
  }

  async verifyPasswordResetToken(token: string) {
    return this.jwtService.verifyAsync<PasswordResetTokenPayload>(token, {
      secret: this.config.getOrThrow<string>('jwt.passwordResetSecret'),
    });
  }

  async signRefreshToken(input: {
    sub: string;
    sid: string;
  }): Promise<IssuedRefreshToken> {
    const { sub, sid } = input;
    const jti = randomUUID();
    const payload: RefreshTokenPayload = { sub, sid, jti };
    const rawToken = await this.jwtService.signAsync(payload, {
      secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      expiresIn: this.config.getOrThrow<string>(
        'jwt.refreshExpiresIn',
      ) as JwtSignOptions['expiresIn'],
    });
    const decoded: unknown = this.jwtService.decode(rawToken);
    if (!hasNumericExp(decoded)) {
      throw new Error('Failed to decode refresh token');
    }
    const expiresAt = new Date(decoded.exp * 1000);
    return { rawToken, jti, expiresAt };
  }

  async verifyRefreshToken(token: string) {
    return this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
      secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
    });
  }
}
