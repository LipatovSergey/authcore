import { ConfigService } from '@nestjs/config';
import ms, { type StringValue } from 'ms';
import type { CookieOptions, Request, Response } from 'express';
import { UnauthorizedException, Injectable } from '@nestjs/common';

@Injectable()
export class RefreshCookieService {
  private readonly cookieName = 'refresh_token';
  private readonly baseOptions: CookieOptions;
  private readonly maxAge: number;
  constructor(config: ConfigService) {
    const refreshExpiresIn = config.getOrThrow<string>('jwt.refreshExpiresIn');
    const parsedMaxAge = ms(refreshExpiresIn as StringValue);
    if (
      typeof parsedMaxAge !== 'number' ||
      !Number.isFinite(parsedMaxAge) ||
      parsedMaxAge <= 0
    ) {
      throw new Error('Invalid refresh token expiration configuration');
    }
    this.maxAge = parsedMaxAge;
    this.baseOptions = {
      httpOnly: true,
      secure: config.getOrThrow<boolean>('refreshCookieSecure'),
      sameSite: 'lax',
      path: '/auth',
    };
  }

  set(response: Response, refreshToken: string): void {
    response.cookie(this.cookieName, refreshToken, {
      ...this.baseOptions,
      maxAge: this.maxAge,
    });
  }

  clear(response: Response): void {
    response.clearCookie(this.cookieName, this.baseOptions);
  }

  getToken(request: Request): string | undefined {
    const cookieRefreshToken: unknown = request.cookies?.[this.cookieName];
    if (cookieRefreshToken === undefined) {
      return undefined;
    }

    if (
      typeof cookieRefreshToken !== 'string' ||
      cookieRefreshToken.length === 0
    ) {
      throw new UnauthorizedException('Invalid refresh credentials');
    }
    return cookieRefreshToken;
  }
}
