import { describe, expect, it } from 'vitest';
import { parseUserAgent } from '../user-agent';

describe('parseUserAgent', () => {
  it('classifies desktop chrome', () => {
    const profile = parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    expect(profile.browser).toBe('Chrome');
    expect(profile.os).toBe('macOS');
    expect(profile.deviceType).toBe('desktop');
    expect(profile.isBot).toBe(false);
  });

  it('classifies mobile safari', () => {
    const profile = parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1');
    expect(profile.browser).toBe('Safari');
    expect(profile.os).toBe('iOS');
    expect(profile.deviceType).toBe('mobile');
  });

  it('classifies bots', () => {
    const profile = parseUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');
    expect(profile.isBot).toBe(true);
    expect(profile.deviceType).toBe('bot');
  });
});

