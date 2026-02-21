export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(storedHash: string, password: string): Promise<boolean>;
  needsRehash(storedHash: string): boolean;
}

export const PASSWORD_HASHER = 'PASSWORD_HASHER';
