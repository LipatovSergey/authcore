import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'node:crypto';

const TOKEN_VERSION = 'v1';
const RANDOM_BYTES = 32;
const HMAC_ALGORITHM = 'sha256';

@Injectable()
export class CsrfTokenService {
  private readonly signingSecret: string;
  constructor(private readonly config: ConfigService) {
    this.signingSecret = this.config.getOrThrow<string>('csrf.signingSecret');
  }

  private generateRandomValue(): string {
    return randomBytes(RANDOM_BYTES).toString('base64url');
  }
  private createSignature(sessionId: string, randomValue: string): string {
    const message = `${TOKEN_VERSION}:${sessionId}:${randomValue}`;
    return createHmac(HMAC_ALGORITHM, this.signingSecret)
      .update(message, 'utf8')
      .digest('base64url');
  }
  private serializeToken(randomValue: string, signature: string): string {
    return `${TOKEN_VERSION}.${randomValue}.${signature}`;
  }

  issueToken(sessionId: string): string {
    if (sessionId.trim().length === 0) {
      throw new Error('Session ID is required to issue a CSRF token');
    }
    const randomValue = this.generateRandomValue();
    const signature = this.createSignature(sessionId, randomValue);
    return this.serializeToken(randomValue, signature);
  }
}
