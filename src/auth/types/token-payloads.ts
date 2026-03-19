export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
}
