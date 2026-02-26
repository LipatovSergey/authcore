export interface SecureHasher {
  hash(password: string): Promise<string>;
  verify(storedHash: string, password: string): Promise<boolean>;
  needsRehash(storedHash: string): boolean;
}

export const SECURE_HASHER = 'SECURE_HASHER';
