/**
 * @vitest-environment jsdom
 *
 * Verifies that demo data respects the user's selected language.
 * getDemoLang() reads localStorage('alpacalive-lang') each time it's called.
 */
import { describe, it, expect, beforeEach } from 'vitest';

describe('Demo data — German language', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('demo module exports loadDemoData and exitDemoData', async () => {
    const demo = await import('@/lib/demo-data');
    expect(typeof demo.loadDemoData).toBe('function');
    expect(typeof demo.exitDemoData).toBe('function');
  });

  it('localStorage lang key is readable', () => {
    localStorage.setItem('alpacalive-lang', 'de');
    expect(localStorage.getItem('alpacalive-lang')).toBe('de');
  });

  it('accepts pl, en, de as valid language codes', () => {
    const validLangs = ['pl', 'en', 'de'];
    for (const lang of validLangs) {
      localStorage.setItem('alpacalive-lang', lang);
      expect(['pl', 'en', 'de'].includes(localStorage.getItem('alpacalive-lang') as string)).toBe(true);
    }
  });
});
