import { describe, it, expect } from 'vitest';
import { formatPatternForChat, type PatternResult } from '@/lib/pattern-engine';

const baseResult: PatternResult = {
  insufficientData: false,
  message: '',
  overallConfidence: 0.75,
  basedOn: ['daily logs', 'wearable'],
  days: [
    {
      date: '2026-05-20',
      dayOfWeek: 'Mo',
      dayInCycle: 5,
      phase: 'B',
      phaseLabel: 'Recovery',
      energy: { predicted: 6, min: 4, max: 8 },
      pain: { predicted: 2, min: 1, max: 3 },
      nausea: { predicted: 1, min: 0, max: 2 },
      mood: { predicted: 6, min: 4, max: 8 },
      recommendations: ['Take it easy'],
      confidence: 0.75,
      dataPoints: 5,
    },
  ],
  patterns: [{ description: 'Energy improving', strength: 0.8 }],
  risks: ['Watch for fatigue'],
};

describe('formatPatternForChat — German', () => {
  it('uses German header when lang=de', () => {
    const text = formatPatternForChat(baseResult, 'de');
    expect(text).toMatch(/Muster aus Ihren letzten 5 Tagen/);
    expect(text).not.toMatch(/Wzorce z Twoich/);
  });

  it('uses German labels for Energy/Pain/Nausea', () => {
    const text = formatPatternForChat(baseResult, 'de');
    expect(text).toMatch(/Energie:/);
    expect(text).toMatch(/Schmerz:/);
    expect(text).toMatch(/Übelkeit:/);
  });

  it('uses German "Erkannte Muster" section header', () => {
    const text = formatPatternForChat(baseResult, 'de');
    expect(text).toMatch(/Erkannte Muster/);
  });

  it('uses German "Risiken" for risks section', () => {
    const text = formatPatternForChat(baseResult, 'de');
    expect(text).toMatch(/Risiken/);
  });

  it('uses German "Tag X des Zyklus" formatting', () => {
    const text = formatPatternForChat(baseResult, 'de');
    expect(text).toMatch(/Tag 5 des Zyklus/);
  });

  it('insufficientData message in German', () => {
    const insufficient = { ...baseResult, insufficientData: true, message: 'Need more data' };
    const text = formatPatternForChat(insufficient, 'de');
    expect(text).toMatch(/Musteranalyse nicht verfügbar/);
  });

  it('English variant works correctly', () => {
    const text = formatPatternForChat(baseResult, 'en');
    expect(text).toMatch(/Patterns from your last 5 days/);
    expect(text).toMatch(/Energy:/);
  });

  it('Polish variant works correctly (default)', () => {
    const text = formatPatternForChat(baseResult, 'pl');
    expect(text).toMatch(/Wzorce z Twoich ostatnich 5 dni/);
    expect(text).toMatch(/Energia:/);
  });

  it('Default (no lang param) uses Polish', () => {
    const text = formatPatternForChat(baseResult);
    expect(text).toMatch(/Wzorce z Twoich ostatnich 5 dni/);
  });
});
