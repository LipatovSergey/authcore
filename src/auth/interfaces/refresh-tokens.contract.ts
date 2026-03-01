export interface CreateRefreshTokenInput {
  tokenHash: string;
  jti: string;
  userId: string;
  expiresAt: Date;
}
