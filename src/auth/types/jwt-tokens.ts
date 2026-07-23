export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  jti: string;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  sessionId: string;
}

export interface EmailVerificationTokenPayload {
  sub: string;
  jti: string;
}

export interface PasswordResetTokenPayload {
  sub: string;
  jti: string;
}

export interface IssuedRefreshToken {
  rawToken: string;
  jti: string;
  expiresAt: Date;
}

export interface IssuedEmailVerificationToken {
  rawToken: string;
  jti: string;
  expiresAt: Date;
}
