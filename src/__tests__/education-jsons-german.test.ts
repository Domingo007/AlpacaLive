import { describe, it, expect } from 'vitest';
import faq from '../../medical-knowledge/cancers/breast/education/faq.json';
import glossary from '../../medical-knowledge/cancers/breast/education/glossary.json';
import phaseGuides from '../../medical-knowledge/cancers/breast/education/phase-guides.json';
import sideEffects from '../../medical-knowledge/cancers/breast/education/side-effect-tips.json';
import whenToCall from '../../medical-knowledge/cancers/breast/education/when-to-call.json';

function hasPlChars(s: string): boolean {
  return /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(s);
}

function allDeStrings(obj: any): string[] {
  const out: string[] = [];
  function walk(v: any) {
    if (typeof v === 'string') return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (v && typeof v === 'object') {
      if (typeof v.de === 'string' && typeof v.en === 'string' && typeof v.pl === 'string') {
        out.push(v.de);
      }
      for (const value of Object.values(v)) walk(value);
    }
  }
  walk(obj);
  return out;
}

describe('Education JSONs — German translations', () => {
  describe('faq.json', () => {
    const deStrings = allDeStrings(faq);
    it('has DE strings present', () => {
      expect(deStrings.length).toBeGreaterThan(0);
    });
    it('no DE string contains Polish diacritics', () => {
      const polish = deStrings.filter(hasPlChars);
      expect(polish).toEqual([]);
    });
    it('DE strings differ from EN fallback in most cases', () => {
      // Spot-check known questions
      const firstQ = (faq as any).questions[0].q;
      expect(firstQ.de).toMatch(/Werde ich meine Haare verlieren/);
      expect(firstQ.de).not.toBe(firstQ.en);
    });
  });

  describe('glossary.json', () => {
    const deStrings = allDeStrings(glossary);
    it('has DE strings present', () => {
      expect(deStrings.length).toBeGreaterThan(0);
    });
    it('no DE string contains Polish diacritics', () => {
      const polish = deStrings.filter(hasPlChars);
      expect(polish).toEqual([]);
    });
    it('Neutropenie term is German', () => {
      const neutro = (glossary as any).terms.find((t: any) => t.id === 'neutropenia');
      expect(neutro.term.de).toBe('Neutropenie');
      expect(neutro.definition.de).toMatch(/Neutrophilenzahl/);
    });
  });

  describe('phase-guides.json', () => {
    const deStrings = allDeStrings(phaseGuides);
    it('has DE strings present', () => {
      expect(deStrings.length).toBeGreaterThan(0);
    });
    it('Phase A is "Krise" in German', () => {
      const crisis = (phaseGuides as any).guides.chemotherapy.crisis.title.de;
      expect(crisis).toMatch(/Krise/);
    });
    it('no DE string contains Polish diacritics', () => {
      const polish = deStrings.filter(hasPlChars);
      expect(polish).toEqual([]);
    });
  });

  describe('side-effect-tips.json', () => {
    const deStrings = allDeStrings(sideEffects);
    it('has DE strings present', () => {
      expect(deStrings.length).toBeGreaterThan(0);
    });
    it('Nausea is "Übelkeit" in German', () => {
      const nausea = (sideEffects as any).tips[0].effect.de;
      expect(nausea).toBe('Übelkeit und Erbrechen');
    });
    it('no DE string contains Polish diacritics', () => {
      const polish = deStrings.filter(hasPlChars);
      expect(polish).toEqual([]);
    });
  });

  describe('when-to-call.json', () => {
    const deStrings = allDeStrings(whenToCall);
    it('has DE strings present', () => {
      expect(deStrings.length).toBeGreaterThan(0);
    });
    it('Emergency is "NOTFALL" in German', () => {
      const emergency = (whenToCall as any).categories[0].title.de;
      expect(emergency).toMatch(/NOTFALL/);
    });
    it('no DE string contains Polish diacritics', () => {
      const polish = deStrings.filter(hasPlChars);
      expect(polish).toEqual([]);
    });
  });
});
