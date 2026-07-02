import { UAParser } from 'ua-parser-js';
export function userAgentParser(userAgent: string | null) {
  if (!userAgent) {
    return {
      browser: 'Unknown',
      os: 'Unknown',
      device: 'Unknown',
    };
  }

  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  return {
    browser: result.browser.name ?? 'Unknown',
    os: result.os.name ?? 'Unknown',
    device: result.device.type ?? 'Desktop',
  };
}
