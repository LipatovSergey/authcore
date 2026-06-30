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

export interface RevokeRefreshTokensBySessionInput {
  sessionId: string;
  revokedAt: Date;
}

export interface RevokeOtherUserRefreshTokensInput {
  userId: string;
  currentSessionId: string;
  revokedAt: Date;
}
