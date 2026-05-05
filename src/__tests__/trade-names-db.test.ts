import { describe, it, expect } from 'vitest';
import tradeNamesData from '../../medical-knowledge/drugs/trade-names/index.json';

interface DrugEntry {
  inn: string;
  inn_aliases?: string[];
  trade_names: Record<string, string[]>;
  drug_class: string;
  route: string;
  common_dosing_oncology?: string;
  breast_cancer_indication?: string;
  key_warnings?: string[];
  ref_urls?: string[];
}

describe('trade names database integrity', () => {
  it('has valid metadata', () => {
    expect(tradeNamesData._metadata).toBeDefined();
    expect(tradeNamesData._metadata.drug_count).toBeGreaterThanOrEqual(40);
    expect(tradeNamesData._metadata.last_verified).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(tradeNamesData._metadata.schema_version).toBeDefined();
  });

  it('contains Paula reference drugs', () => {
    expect(tradeNamesData.trade_names.trazodone).toBeDefined();
    expect(tradeNamesData.trade_names.venlafaxine).toBeDefined();
    expect(tradeNamesData.trade_names.paclitaxel).toBeDefined();
    expect(tradeNamesData.trade_names.gemcitabine).toBeDefined();
  });

  it('recognizes key 2024-2025 approvals', () => {
    expect(tradeNamesData.trade_names.trastuzumab_deruxtecan).toBeDefined();
    expect(tradeNamesData.trade_names.inavolisib).toBeDefined();
    expect(tradeNamesData.trade_names.elacestrant).toBeDefined();
    expect(tradeNamesData.trade_names.imlunestrant).toBeDefined();
    expect(tradeNamesData.trade_names.datopotamab_deruxtecan).toBeDefined();
  });

  it('Trittico maps to trazodone (PL brand)', () => {
    const trazodone = tradeNamesData.trade_names.trazodone as DrugEntry;
    expect(trazodone.trade_names.pl).toContain('Trittico');
  });

  it('Alventa maps to venlafaxine (PL KRKA brand)', () => {
    const venlafaxine = tradeNamesData.trade_names.venlafaxine as DrugEntry;
    expect(venlafaxine.trade_names.pl).toContain('Alventa');
  });

  it('Enhertu maps to trastuzumab_deruxtecan (global brand)', () => {
    const tdxd = tradeNamesData.trade_names.trastuzumab_deruxtecan as DrugEntry;
    expect(tdxd.trade_names.global).toContain('Enhertu');
  });

  it('every drug has required fields (inn, trade_names, drug_class, route)', () => {
    const drugs = Object.entries(tradeNamesData.trade_names) as Array<[string, DrugEntry]>;
    expect(drugs.length).toBeGreaterThanOrEqual(40);

    for (const [key, drug] of drugs) {
      expect(drug.inn, `${key} missing inn`).toBeDefined();
      expect(drug.trade_names, `${key} missing trade_names`).toBeDefined();
      expect(drug.drug_class, `${key} missing drug_class`).toBeDefined();
      expect(drug.route, `${key} missing route`).toBeDefined();
    }
  });

  it('no unintended duplicate trade names across drugs (Phesgo and Herceptin Hylecta excepted)', () => {
    const allTradeNames = new Map<string, string[]>();
    const regions = ['pl', 'de', 'eu', 'uk', 'us', 'global'];

    for (const [inn, drug] of Object.entries(tradeNamesData.trade_names) as Array<[string, DrugEntry]>) {
      for (const region of regions) {
        const names = drug.trade_names[region] || [];
        for (const name of names) {
          if (!allTradeNames.has(name)) allTradeNames.set(name, []);
          const list = allTradeNames.get(name)!;
          if (!list.includes(inn)) list.push(inn);
        }
      }
    }

    const expectedDuplicates = ['Phesgo', 'Herceptin Hylecta'];
    const unexpectedDuplicates: string[] = [];

    for (const [name, inns] of allTradeNames) {
      if (inns.length > 1 && !expectedDuplicates.includes(name)) {
        unexpectedDuplicates.push(`${name} -> ${inns.join(', ')}`);
      }
    }

    expect(unexpectedDuplicates).toEqual([]);
  });
});
