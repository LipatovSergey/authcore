const AUTHCORE_TOKENS = {
  ACCESS: 'authcore_access_token',
  REFRESH: 'authcore_refresh_token',
} as const;

type AuthTokens = {
  access_token: string;
  refresh_token: string;
};

export function saveTokens(tokens: AuthTokens) {
  if (!tokens.access_token || !tokens.refresh_token) {
    console.error('Login response does not include tokens');
    throw new Error('Login response does not include tokens');
  }
  clearTokens();
  localStorage.setItem(AUTHCORE_TOKENS.ACCESS, tokens.access_token);
  localStorage.setItem(AUTHCORE_TOKENS.REFRESH, tokens.refresh_token);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(AUTHCORE_TOKENS.ACCESS);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(AUTHCORE_TOKENS.REFRESH);
}

export function clearTokens() {
  localStorage.removeItem(AUTHCORE_TOKENS.ACCESS);
  localStorage.removeItem(AUTHCORE_TOKENS.REFRESH);
}

export function hasStoredSession(): boolean {
  return Boolean(getRefreshToken());
}
