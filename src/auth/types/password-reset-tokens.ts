export interface CreatePasswordResetTokenInput {
  rawToken: string;
  jti: string;
  userId: string;
  expiresAt: Date;
}

export interface MarkTokenAsUsedInput {
  id: string;
  now: Date;
}
