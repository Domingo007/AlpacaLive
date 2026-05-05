import { describe, it, expect } from 'vitest';
import { resolveDrug, detectUnknownDrugs } from '../lib/medical-data/drug-resolver';

describe('drug resolver', () => {
  describe('INN matching', () => {
    it('resolves trazodone by INN', () => {
      const r = resolveDrug('trazodone');
      expect(r?.inn).toBe('trazodone');
      expect(r?.matchType).toBe('inn');
      expect(r?.isBiosimilar).toBe(false);
    });

    it('resolves paclitaxel by INN', () => {
      const r = resolveDrug('paclitaxel');
      expect(r?.inn).toBe('paclitaxel');
    });
  });

  describe('alias matching (PL/DE)', () => {
    it('resolves wenlafaksyna -> venlafaxine', () => {
      const r = resolveDrug('wenlafaksyna');
      expect(r?.inn).toBe('venlafaxine');
      expect(r?.matchType).toBe('alias');
      expect(r?.isBiosimilar).toBe(false);
    });

    it('resolves trazodon -> trazodone', () => {
      const r = resolveDrug('trazodon');
      expect(r?.inn).toBe('trazodone');
    });

    it('resolves gemcytabina -> gemcitabine', () => {
      const r = resolveDrug('gemcytabina');
      expect(r?.inn).toBe('gemcitabine');
    });
  });

  describe('trade name matching', () => {
    it('resolves Trittico -> trazodone (PL)', () => {
      const r = resolveDrug('Trittico');
      expect(r?.inn).toBe('trazodone');
      expect(r?.matchType).toBe('trade');
      expect(r?.isBiosimilar).toBe(false);
    });

    it('resolves Alventa -> venlafaxine (PL KRKA)', () => {
      const r = resolveDrug('Alventa');
      expect(r?.inn).toBe('venlafaxine');
    });

    it('resolves Enhertu -> trastuzumab_deruxtecan (global)', () => {
      const r = resolveDrug('Enhertu');
      expect(r?.inn).toBe('trastuzumab_deruxtecan');
    });

    it('resolves Ibrance -> palbociclib', () => {
      const r = resolveDrug('Ibrance');
      expect(r?.inn).toBe('palbociclib');
    });

    it('resolves Itovebi -> inavolisib (2024 approval)', () => {
      const r = resolveDrug('Itovebi');
      expect(r?.inn).toBe('inavolisib');
    });

    it('resolves Kisqali -> ribociclib', () => {
      const r = resolveDrug('Kisqali');
      expect(r?.inn).toBe('ribociclib');
    });

    it('resolves Lynparza -> olaparib', () => {
      const r = resolveDrug('Lynparza');
      expect(r?.inn).toBe('olaparib');
    });

    it('distinguishes Xgeva (oncology) and Prolia (osteo) — both denosumab', () => {
      expect(resolveDrug('Xgeva')?.inn).toBe('denosumab');
      expect(resolveDrug('Prolia')?.inn).toBe('denosumab');
    });

    it('distinguishes Zometa (oncology) and Reclast (osteo) — both zoledronic_acid', () => {
      expect(resolveDrug('Zometa')?.inn).toBe('zoledronic_acid');
      expect(resolveDrug('Reclast')?.inn).toBe('zoledronic_acid');
    });
  });

  describe('biosimilar matching', () => {
    it('flags Kanjinti as biosimilar of trastuzumab', () => {
      const r = resolveDrug('Kanjinti');
      expect(r?.inn).toBe('trastuzumab');
      expect(r?.isBiosimilar).toBe(true);
    });

    it('does not flag Herceptin as biosimilar', () => {
      const r = resolveDrug('Herceptin');
      expect(r?.inn).toBe('trastuzumab');
      expect(r?.isBiosimilar).toBe(false);
    });

    it('flags Jubbonti as biosimilar of denosumab', () => {
      const r = resolveDrug('Jubbonti');
      expect(r?.inn).toBe('denosumab');
      expect(r?.isBiosimilar).toBe(true);
    });
  });

  describe('suffix normalization', () => {
    it('matches Trittico XL', () => {
      const r = resolveDrug('Trittico XL');
      expect(r?.inn).toBe('trazodone');
    });

    it('matches Effexor XR', () => {
      const r = resolveDrug('Effexor XR');
      expect(r?.inn).toBe('venlafaxine');
    });
  });

  describe('fuzzy matching (typos)', () => {
    it('tolerates typo Herceptim -> Herceptin', () => {
      const r = resolveDrug('Herceptim');
      expect(r?.inn).toBe('trastuzumab');
      expect(r?.matchType).toBe('fuzzy');
    });

    it('tolerates typo Taxxol -> Taxol', () => {
      const r = resolveDrug('Taxxol');
      expect(r?.inn).toBe('paclitaxel');
    });

    it('does not match a completely unrelated word', () => {
      const r = resolveDrug('avocado');
      expect(r).toBeNull();
    });
  });

  describe('unknown drug detection', () => {
    it('detects unknown drug in patient message', () => {
      const msg = 'I started taking Xyzabc 50mg last week';
      const unknown = detectUnknownDrugs(msg);
      expect(unknown).toContain('Xyzabc');
    });

    it('does not flag known drugs', () => {
      const msg = 'I take Trittico and Alventa daily, plus weekly Taxol';
      const unknown = detectUnknownDrugs(msg);
      expect(unknown).toHaveLength(0);
    });

    it('does not flag common non-drug capitalized words', () => {
      const msg = 'Monday I see doctor in Germany';
      const unknown = detectUnknownDrugs(msg);
      expect(unknown).toHaveLength(0);
    });
  });
});
