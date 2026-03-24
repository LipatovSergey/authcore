export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export interface EmailVerificationTokenPayload {
  sub: string;
  jti: string;
}

export interface SignedRefreshToken {
  token: string;
  jti: string;
  expiresAt: Date;
}

export interface SignedEmailVerificationToken {
  token: string;
  jti: string;
  expiresAt: Date;
}
