export interface CreateEmailVerificationTokenInput {
  rawToken: string;
  jti: string;
  userId: string;
  expiresAt: Date;
}
