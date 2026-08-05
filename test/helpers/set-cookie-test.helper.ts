export function getSetCookie(
  setCookieHeader: unknown,
  cookieName: string,
): string {
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];
  const cookie = cookies.find(
    (value): value is string =>
      typeof value === 'string' && value.startsWith(`${cookieName}=`),
  );

  if (!cookie) {
    throw new Error(`${cookieName} cookie was not set`);
  }

  return cookie;
}

export function parseSetCookie(cookie: string): {
  nameAndValue: string;
  attributes: Set<string>;
} {
  const [nameAndValue, ...attributes] = cookie
    .split(';')
    .map((part) => part.trim());

  return {
    nameAndValue,
    attributes: new Set(attributes),
  };
}

export function getRefreshTokenFromCookie(setCookieHeader: unknown): string {
  const refreshCookie = getSetCookie(setCookieHeader, 'refresh_token');
  const { nameAndValue } = parseSetCookie(refreshCookie);
  const cookiePrefix = 'refresh_token=';
  const rawRefreshToken = nameAndValue.slice(cookiePrefix.length);

  if (!nameAndValue.startsWith(cookiePrefix) || rawRefreshToken.length === 0) {
    throw new Error('Refresh token cookie value is missing');
  }

  return rawRefreshToken;
}

export function getCsrfTokenFromCookie(setCookieHeader: unknown): string {
  const csrfCookie = getSetCookie(setCookieHeader, 'csrf_token');
  const { nameAndValue } = parseSetCookie(csrfCookie);
  const cookiePrefix = 'csrf_token=';
  const rawCsrfToken = nameAndValue.slice(cookiePrefix.length);

  if (!nameAndValue.startsWith(cookiePrefix) || rawCsrfToken.length === 0) {
    throw new Error('CSRF token cookie value is missing');
  }

  return rawCsrfToken;
}

function isCookieExpired(attributes: Set<string>): boolean {
  const expires = [...attributes].find((attribute) =>
    attribute.startsWith('Expires='),
  );
  return (
    attributes.has('Max-Age=0') ||
    (expires !== undefined &&
      Date.parse(expires.slice('Expires='.length)) <= Date.now())
  );
}

export function expectRefreshCookieCleared(setCookieHeader: unknown): void {
  const cookie = getSetCookie(setCookieHeader, 'refresh_token');
  const { nameAndValue, attributes } = parseSetCookie(cookie);

  expect(nameAndValue).toBe('refresh_token=');
  expect(attributes).toContain('HttpOnly');
  expect(attributes).toContain('Path=/auth');
  expect(attributes).toContain('SameSite=Lax');
  expect(attributes).not.toContain('Secure');
  expect(isCookieExpired(attributes)).toBe(true);
}

export function expectCsrfCookieCleared(setCookieHeader: unknown): void {
  const cookie = getSetCookie(setCookieHeader, 'csrf_token');
  const { nameAndValue, attributes } = parseSetCookie(cookie);

  expect(nameAndValue).toBe('csrf_token=');
  expect(attributes).not.toContain('HttpOnly');
  expect(attributes).toContain('Path=/');
  expect(attributes).toContain('SameSite=Lax');
  expect(attributes).not.toContain('Secure');
  expect(isCookieExpired(attributes)).toBe(true);
}
