export interface CreatePasswordResetTokenInput {
  rawToken: string;
  jti: string;
  userId: string;
  expiresAt: Date;
}
