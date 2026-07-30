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
  rotatedAt: Date;
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

export interface RevokeAllUserRefreshTokensInput {
  userId: string;
  revokedAt: Date;
}
