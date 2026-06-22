export interface CreateRefreshTokenInput {
  rawToken: string;
  jti: string;
  userId: string;
  sessionId: string;
  expiresAt: Date;
}

export interface RotateRefreshTokenInput {
  oldTokenId: string;
  newTokenInput: CreateRefreshTokenInput;
}
