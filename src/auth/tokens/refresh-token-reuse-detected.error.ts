export class RefreshTokenReuseDetectedError extends Error {
  readonly userId: string;

  constructor(userId: string) {
    super('Refresh token reuse detected');

    this.name = 'RefreshTokenReuseDetectedError';
    this.userId = userId;
  }
}
