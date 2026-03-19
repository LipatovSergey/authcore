export interface SignedRefreshToken {
  token: string;
  jti: string;
  expiresAt: Date;
}
