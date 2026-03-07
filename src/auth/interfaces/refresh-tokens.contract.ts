export interface CreateRefreshTokenInput {
  tokenHash: string;
  jti: string;
  userId: string;
  expiresAt: Date;
}

export interface RotateRefreshTokenInput {
  oldTokenId: string;
  newTokenInput: CreateRefreshTokenInput;
}
