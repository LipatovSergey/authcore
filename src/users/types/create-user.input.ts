export interface CreateUserInput {
  email: string;
  passwordHash: string;
  unverifiedExpiresAt: Date;
}
