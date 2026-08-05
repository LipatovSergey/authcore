import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import ms, { type StringValue } from 'ms';

@Injectable()
export class CsrfCookieService {
  private readonly baseOptions: CookieOptions;
  private readonly cookieName = 'csrf_token';
  private readonly cookiePath = '/';
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
      httpOnly: false,
      secure: config.getOrThrow<boolean>('refreshCookieSecure'),
      sameSite: 'lax',
      path: this.cookiePath,
    };
  }

  set(response: Response, csrfToken: string): void {
    response.cookie(this.cookieName, csrfToken, {
      ...this.baseOptions,
      maxAge: this.maxAge,
    });
  }

  clear(response: Response): void {
    response.clearCookie(this.cookieName, this.baseOptions);
  }
}
