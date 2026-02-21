import type { PasswordHasher } from '../interfaces/password-hasher.interface';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  constructor(private readonly config: ConfigService) {}
  private getHashOptions() {
    return {
      memoryCost: Number(
        this.config.get<string>('ARGON2_MEMORY_COST', '19456'),
      ),
      timeCost: Number(this.config.get<string>('ARGON2_TIME_COST', '2')),
      parallelism: Number(this.config.get<string>('ARGON2_PARALLELISM', '1')),
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
