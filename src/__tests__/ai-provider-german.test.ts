import { describe, it, expect } from 'vitest';
import { getProviderInfo } from '@/lib/ai-provider';

describe('AI Provider info — German', () => {
  it('returns German descriptions when lang=de', () => {
    const info = getProviderInfo('de');
    expect(info.anthropic.description).toMatch(/Beste medizinische Genauigkeit/);
    expect(info.openai.description).toMatch(/Solides medizinisches Wissen/);
    expect(info.gemini.description).toMatch(/Kostenlose Stufe/);
  });

  it('returns German cost labels with euro symbol', () => {
    const info = getProviderInfo('de');
    expect(info.anthropic.cost).toMatch(/€\/Monat/);
    expect(info.gemini.cost).toMatch(/Kostenlos/);
  });

  it('returns Polish descriptions when lang=pl', () => {
    const info = getProviderInfo('pl');
    expect(info.anthropic.description).toMatch(/Najlepsza dokładność medyczna/);
    expect(info.anthropic.cost).toMatch(/zł\/mies/);
  });

  it('returns English descriptions when lang=en', () => {
    const info = getProviderInfo('en');
    expect(info.anthropic.description).toMatch(/Best medical accuracy/);
    expect(info.anthropic.cost).toMatch(/\$/);
  });

  it('defaults to Polish when no lang given', () => {
    const info = getProviderInfo();
    expect(info.anthropic.description).toMatch(/Najlepsza dokładność medyczna/);
  });

  it('all three providers exist for all three languages', () => {
    for (const lang of ['pl', 'en', 'de'] as const) {
      const info = getProviderInfo(lang);
      expect(info.anthropic).toBeDefined();
      expect(info.openai).toBeDefined();
      expect(info.gemini).toBeDefined();
      expect(info.anthropic.link).toBe('console.anthropic.com');
      expect(info.openai.link).toBe('platform.openai.com');
    }
  });
});
