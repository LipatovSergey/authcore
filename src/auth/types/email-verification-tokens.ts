export interface CreateEmailVerificationTokenInput {
  rawToken: string;
  jti: string;
  userId: string;
  expiresAt: Date;
}

export interface MarkEmailVerificationTokenAsUsedInput {
  id: string;
  now: Date;
}
