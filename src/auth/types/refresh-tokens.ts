export interface CreateRefreshTokenInput {
  rawToken: string;
  jti: string;
  userId: string;
  expiresAt: Date;
}

export interface RotateRefreshTokenInput {
  oldTokenId: string;
  newTokenInput: CreateRefreshTokenInput;
}
