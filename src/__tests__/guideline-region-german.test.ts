import { describe, it, expect } from 'vitest';
import { detectGuidelineRegion } from '@/types';

describe('detectGuidelineRegion — multilingual country names', () => {
  describe('Polish country names', () => {
    it('Polska → europe', () => {
      expect(detectGuidelineRegion('Polska')).toBe('europe');
    });
    it('Niemcy → europe', () => {
      expect(detectGuidelineRegion('Niemcy')).toBe('europe');
    });
    it('USA → usa', () => {
      expect(detectGuidelineRegion('USA')).toBe('usa');
    });
  });

  describe('English country names', () => {
    it('Poland → europe', () => {
      expect(detectGuidelineRegion('Poland')).toBe('europe');
    });
    it('Germany → europe', () => {
      expect(detectGuidelineRegion('Germany')).toBe('europe');
    });
    it('United States → usa', () => {
      expect(detectGuidelineRegion('United States')).toBe('usa');
    });
  });

  describe('German country names', () => {
    it('Deutschland → europe', () => {
      expect(detectGuidelineRegion('Deutschland')).toBe('europe');
    });
    it('Polen → europe', () => {
      expect(detectGuidelineRegion('Polen')).toBe('europe');
    });
    it('Österreich → europe', () => {
      expect(detectGuidelineRegion('Österreich')).toBe('europe');
    });
    it('Schweiz → europe', () => {
      expect(detectGuidelineRegion('Schweiz')).toBe('europe');
    });
    it('Vereinigte Staaten → usa', () => {
      expect(detectGuidelineRegion('Vereinigte Staaten')).toBe('usa');
    });
  });

  it('unknown country → other', () => {
    expect(detectGuidelineRegion('Tanzania')).toBe('other');
    expect(detectGuidelineRegion('')).toBe('other');
  });
});
