import tradeNamesData from '../../../medical-knowledge/drugs/trade-names/index.json';

export interface DrugEntry {
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

export type MatchType = 'inn' | 'alias' | 'trade' | 'fuzzy';

export interface ResolveResult {
  inn: string;
  matchedName: string;
  matchType: MatchType;
  isBiosimilar: boolean;
  drugData: DrugEntry;
}

const DRUGS = tradeNamesData.trade_names as Record<string, DrugEntry>;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b(xl|xr|sr|er|ir|cr|hcl|citrate|sodium|hydrochloride)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const m: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) m[i][0] = i;
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      m[i][j] = Math.min(
        m[i - 1][j] + 1,
        m[i][j - 1] + 1,
        m[i - 1][j - 1] + cost,
      );
    }
  }
  return m[a.length][b.length];
}

export function resolveDrug(input: string): ResolveResult | null {
  const query = normalize(input);
  if (!query) return null;

  for (const [inn, drug] of Object.entries(DRUGS)) {
    if (normalize(drug.inn) === query) {
      return { inn, matchedName: drug.inn, matchType: 'inn', isBiosimilar: false, drugData: drug };
    }
  }

  for (const [inn, drug] of Object.entries(DRUGS)) {
    for (const alias of drug.inn_aliases || []) {
      if (normalize(alias) === query) {
        return { inn, matchedName: alias, matchType: 'alias', isBiosimilar: false, drugData: drug };
      }
    }
  }

  for (const [inn, drug] of Object.entries(DRUGS)) {
    for (const [region, names] of Object.entries(drug.trade_names)) {
      for (const name of names || []) {
        if (normalize(name) === query) {
          return {
            inn,
            matchedName: name,
            matchType: 'trade',
            isBiosimilar: region === 'biosimilars',
            drugData: drug,
          };
        }
      }
    }
  }

  let best: { inn: string; name: string; distance: number; isBiosimilar: boolean; drug: DrugEntry } | null = null;
  for (const [inn, drug] of Object.entries(DRUGS)) {
    const candidates: Array<{ name: string; isBiosimilar: boolean }> = [
      { name: drug.inn, isBiosimilar: false },
      ...(drug.inn_aliases || []).map(a => ({ name: a, isBiosimilar: false })),
      ...Object.entries(drug.trade_names).flatMap(([region, names]) =>
        (names || []).map(n => ({ name: n, isBiosimilar: region === 'biosimilars' })),
      ),
    ];
    for (const c of candidates) {
      const distance = levenshtein(query, normalize(c.name));
      if (distance <= 2 && (!best || distance < best.distance)) {
        best = { inn, name: c.name, distance, isBiosimilar: c.isBiosimilar, drug };
      }
    }
  }

  if (best) {
    return {
      inn: best.inn,
      matchedName: best.name,
      matchType: 'fuzzy',
      isBiosimilar: best.isBiosimilar,
      drugData: best.drug,
    };
  }

  return null;
}

const STOP_WORDS = new Set([
  'Paula', 'Dominik', 'Anna',
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
  'Poland', 'Germany', 'Polska', 'Niemcy', 'USA', 'Europe', 'Europa',
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'Today', 'Tomorrow', 'Yesterday',
]);

export function detectUnknownDrugs(text: string): string[] {
  const candidates = text.match(/\b[A-Z][a-z]{3,}(?:\s+[A-Z]{2,})?\b/g) || [];
  const unknown: string[] = [];

  for (const candidate of candidates) {
    if (STOP_WORDS.has(candidate)) continue;
    if (candidate.length < 4) continue;

    if (!resolveDrug(candidate)) {
      unknown.push(candidate);
    }
  }

  return [...new Set(unknown)];
}
