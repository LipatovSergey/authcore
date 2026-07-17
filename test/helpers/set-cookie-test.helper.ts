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

export function expectRefreshCookieCleared(setCookieHeader: unknown): void {
  const cookie = getSetCookie(setCookieHeader, 'refresh_token');
  const { nameAndValue, attributes } = parseSetCookie(cookie);
  const expires = [...attributes].find((attribute) =>
    attribute.startsWith('Expires='),
  );
  const isExpired =
    attributes.has('Max-Age=0') ||
    (expires !== undefined &&
      Date.parse(expires.slice('Expires='.length)) <= Date.now());

  expect(nameAndValue).toBe('refresh_token=');
  expect(attributes).toContain('HttpOnly');
  expect(attributes).toContain('Path=/auth');
  expect(attributes).toContain('SameSite=Lax');
  expect(attributes).not.toContain('Secure');
  expect(isExpired).toBe(true);
}
