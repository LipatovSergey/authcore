import type { SecureHasher } from '../interfaces/secure-hasher.interface';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

@Injectable()
export class Argon2PasswordHasher implements SecureHasher {
  constructor(private readonly config: ConfigService) {}
  private getHashOptions() {
    return {
      memoryCost: this.config.get<number>('argon2.memoryCost'),
      timeCost: this.config.get<number>('argon2.timeCost'),
      parallelism: this.config.get<number>('argon2.parallelism'),
      type: argon2.argon2id,
    };
  }

  hash(password: string): Promise<string> {
    const options = this.getHashOptions();
    return argon2.hash(password, options);
  }
  verify(storedHash: string, password: string): Promise<boolean> {
    return argon2.verify(storedHash, password);
  }
  needsRehash(storedHash: string): boolean {
    const options = this.getHashOptions();
    return argon2.needsRehash(storedHash, options);
  }
}
