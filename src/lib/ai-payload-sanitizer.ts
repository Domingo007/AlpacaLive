/*
 * AlpacaLive — AI Payload Sanitizer
 * Transforms PatientProfile into SanitizedAIProfile for secure AI transmission.
 * Removes CRITICAL + HIGH PII, abstracts identifiable data.
 *
 * Examples of transformation:
 * - age 35 → "30-40" (decade)
 * - displayName "Paula" → REMOVED
 * - location.treatmentFacility "Szpital X" → REMOVED (replaced with guidelineRegion)
 * - psychiatricMeds "Sertralin 50mg" → "SSRI"
 * - drug "Taxol" → "paklitaksel (Taxol)"
 */

import type { PatientProfile } from '@/types';
import { resolveDrug, type DrugEntry } from './medical-data/drug-resolver';

// ==================== PUBLIC TYPES ====================

export interface MedEntry {
  inn: string;
  dose?: string;
}

export interface SupplementEntry {
  name: string;
  dose?: string;
}

export interface SanitizedAIProfile {
  // Abstracted demographic data
  ageDecade: string; // "30-40", "40-50", etc.
  weightKg: number;

  // Clinical data — no identifiers
  diagnosis: string;
  stage: string;
  molecularSubtype?: string;
  erStatus?: string;
  prStatus?: string;
  her2Status?: string;
  ki67?: number | null;
  brcaStatus?: string;
  breastCancerSubtype?: string; // e.g., "luminal_a", "her2_positive"
  pdl1Status?: string;
  pdl1Score?: number | null;
  piK3caStatus?: string;

  // Medical history
  surgeries: string[];
  currentChemo: string;

  // Medications — INN form or abstracted
  oncologyMeds: MedEntry[];
  otherMeds: MedEntry[];
  psychiatricMedClasses: string[]; // e.g., ["SSRI", "benzodiazepina"], not names

  // Regional context (not location)
  guidelineRegion: 'ESMO' | 'NCCN' | 'both';

  // Language
  appLanguage: string;
}

// ==================== CONSTANTS ====================

const ESMO_COUNTRIES = ['PL', 'DE', 'FR', 'AT', 'ES', 'IT', 'NL', 'CZ', 'SK', 'HU', 'RO', 'SE', 'NO', 'DK', 'FI', 'CH', 'BE', 'PT', 'GR', 'LU', 'IE', 'GB', 'IS', 'SI', 'HR', 'BG', 'LT', 'LV', 'EE', 'CY', 'MT'];
const NCCN_COUNTRIES = ['US', 'CA'];

// Psychiatric drug class mapping
const PSYCHIATRIC_DRUG_CLASS_MAP: Record<string, string> = {
  // SSRIs
  'sertralin': 'SSRI',
  'sertralina': 'SSRI',
  'sertraline': 'SSRI',
  'escitalopram': 'SSRI',
  'lexapro': 'SSRI',
  'fluoksetyna': 'SSRI',
  'prozac': 'SSRI',
  'fluoxetine': 'SSRI',
  'paroksetyna': 'SSRI',
  'paxil': 'SSRI',
  'fluwoksamina': 'SSRI',
  'fevarin': 'SSRI',

  // SNRIs
  'wenlafaksyna': 'SNRI',
  'venlafaksyna': 'SNRI',
  'effexor': 'SNRI',
  'duloksetyna': 'SNRI',
  'cymbalta': 'SNRI',
  'desvenlafaksyna': 'SNRI',

  // Benzodiazepines
  'alprazolam': 'benzodiazepina',
  'xanax': 'benzodiazepina',
  'lorazepam': 'benzodiazepina',
  'ativan': 'benzodiazepina',
  'diazepam': 'benzodiazepina',
  'relanium': 'benzodiazepina',
  'klonazepam': 'benzodiazepina',
  'clonazepam': 'benzodiazepina',
  'rivotril': 'benzodiazepina',

  // Sleep aids
  'zolpidem': 'lek nasenny',
  'stilnox': 'lek nasenny',
  'zopiklon': 'lek nasenny',
  'melatonina': 'melatonina',
  'melatonin': 'melatonina',

  // Atypical antipsychotics
  'kwetiapina': 'atypowy antypsychotyk',
  'quetiapina': 'atypowy antypsychotyk',
  'seroquel': 'atypowy antypsychotyk',
  'olanzapina': 'atypowy antypsychotyk',
  'olanzapine': 'atypowy antypsychotyk',
  'zyprexa': 'atypowy antypsychotyk',
  'risperidone': 'atypowy antypsychotyk',
  'risperydon': 'atypowy antypsychotyk',
  'rispolept': 'atypowy antypsychotyk',

  // Other antidepressants
  'mirtazapina': 'NaSSA',
  'mirtazapine': 'NaSSA',
  'remeron': 'NaSSA',
  'bupropion': 'NDRI',
  'wellbutrin': 'NDRI',
  'trazodon': 'tracyjklik',
  'trazodone': 'tracyjklik',

  // Anxiolytics
  'buspiron': 'anksjolityk',
  'buspar': 'anksjolityk',
  'hydroxyzyna': 'anksjolityk',
  'atarax': 'anksjolityk',

  // Anti-convulsants (used for psychiatric indications)
  'pregabalina': 'antykonwulsant',
  'lyrica': 'antykonwulsant',
  'gabapentyna': 'antykonwulsant',
  'gabapentin': 'antykonwulsant',
  'neurontin': 'antykonwulsant',
};

// ==================== MAIN SANITIZER ====================

export function sanitizePatientForAI(profile: PatientProfile): SanitizedAIProfile {
  // 1. Age decade
  const decade = Math.floor(profile.age / 10) * 10;
  const ageDecade = `${decade}-${decade + 10}`;

  // 2. Guideline region from treatment country
  const guidelineRegion = resolveGuidelineRegion(profile.location?.treatmentCountry);

  // 3. Psychiatric med classes (abstracted)
  const psychiatricMedClasses = (profile.psychiatricMeds ?? [])
    .map(med => resolvePsychiatricDrugClass(med.name))
    .filter(c => c !== null) as string[];

  // 4. Resolve trade names → INN for oncology meds
  const oncologyMeds = (profile.oncologyMeds ?? []).map(med => {
    const resolved = resolveDrug(med.name);
    return {
      inn: resolved?.inn ?? med.name,
      dose: med.dose,
    };
  });

  // 5. Resolve trade names → INN for other meds
  const otherMeds = (profile.otherMeds ?? []).map(med => {
    const resolved = resolveDrug(med.name);
    return {
      inn: resolved?.inn ?? med.name,
      dose: med.dose,
    };
  });

  return {
    ageDecade,
    weightKg: profile.weight,
    diagnosis: profile.diagnosis,
    stage: profile.stage,
    molecularSubtype: profile.molecularSubtype,
    erStatus: profile.erStatus,
    prStatus: profile.prStatus,
    her2Status: profile.her2Status,
    ki67: profile.ki67 ?? null,
    brcaStatus: profile.brcaStatus ?? 'unknown',
    breastCancerSubtype: profile.breastCancerSubtype,
    pdl1Status: profile.pdl1Status,
    pdl1Score: profile.pdl1Score,
    piK3caStatus: profile.piK3caStatus,
    surgeries: profile.surgeries ?? [],
    currentChemo: profile.currentChemo ?? '',
    oncologyMeds,
    otherMeds,
    psychiatricMedClasses,
    guidelineRegion,
    appLanguage: profile.languages?.appLanguage ?? 'pl',
  };
}

// ==================== HELPERS ====================

export function resolveGuidelineRegion(
  treatmentCountry?: string,
): 'ESMO' | 'NCCN' | 'both' {
  if (!treatmentCountry) return 'ESMO';

  // Handle various country name formats
  const countryName = treatmentCountry.trim().toUpperCase();

  // Check NCCN countries
  if (NCCN_COUNTRIES.includes(countryName)) return 'NCCN';

  // Check ESMO countries
  if (ESMO_COUNTRIES.includes(countryName)) return 'ESMO';

  // Map country name to country code if needed
  const countryMap: Record<string, string> = {
    'POLSKA': 'PL',
    'POLAND': 'PL',
    'NIEMCY': 'DE',
    'GERMANY': 'DE',
    'FRANCJA': 'FR',
    'FRANCE': 'FR',
    'AUSTIRA': 'AT',
    'SPAIN': 'ES',
    'ITALIA': 'IT',
    'ITALY': 'IT',
    'HOLANDIA': 'NL',
    'NETHERLANDS': 'NL',
    'USA': 'US',
    'STANY ZJEDNOCZONE': 'US',
    'KANADA': 'CA',
    'CANADA': 'CA',
  };

  const mappedCode = countryMap[countryName];
  if (mappedCode && NCCN_COUNTRIES.includes(mappedCode)) return 'NCCN';
  if (mappedCode && ESMO_COUNTRIES.includes(mappedCode)) return 'ESMO';

  return 'both'; // Unknown country — provide both
}

/**
 * Resolve psychiatric drug name to class (e.g., "Sertralin 50mg" → "SSRI")
 * Returns null if not found (will be filtered out).
 */
export function resolvePsychiatricDrugClass(drugName: string): string | null {
  if (!drugName) return null;

  const normalized = drugName.toLowerCase().trim();

  // 1. Check hardcoded map
  if (PSYCHIATRIC_DRUG_CLASS_MAP[normalized]) {
    return PSYCHIATRIC_DRUG_CLASS_MAP[normalized];
  }

  // 2. Try to match first word (handles "Sertralin 50mg" → "sertralin")
  const firstWord = normalized.split(/\s+/)[0];
  if (PSYCHIATRIC_DRUG_CLASS_MAP[firstWord]) {
    return PSYCHIATRIC_DRUG_CLASS_MAP[firstWord];
  }

  // 3. Try drug-resolver if it has drug_class info
  const resolved = resolveDrug(drugName);
  if (resolved?.drugData?.drug_class) {
    // Map generic drug_class to psychiatric term if needed
    const drugClass = resolved.drugData.drug_class.toLowerCase();
    if (drugClass.includes('ssri')) return 'SSRI';
    if (drugClass.includes('snri')) return 'SNRI';
    if (drugClass.includes('benzodiazepine') || drugClass.includes('benzodiazepin'))
      return 'benzodiazepina';
    if (drugClass.includes('antipsychotic')) return 'atypowy antypsychotyk';
    // Return the class as-is if we don't recognize it
    return resolved.drugData.drug_class;
  }

  // 4. Fallback: if name contains any psychiatric drug keyword, return generic
  if (/lek\s+psychiatr|psychofarmak|antydepres|anksjolity|uspoka/.test(normalized)) {
    return 'psychofarmakoterapia';
  }

  return null;
}

/**
 * Format chemo drug for display in system prompt.
 * "Taxol" → "paklitaksel (Taxol)" for clarity.
 */
export function formatChemoDrugForAI(drugName: string): string {
  const resolved = resolveDrug(drugName);
  if (resolved && resolved.inn !== drugName) {
    // Trade name found, show INN first then trade name
    return `${resolved.inn} (${drugName})`;
  }
  // Already INN or unknown
  return drugName;
}
