import { describe, it, expect } from 'vitest';
import {
  sanitizePatientForAI,
  resolveGuidelineRegion,
  resolvePsychiatricDrugClass,
  formatChemoDrugForAI,
  type SanitizedAIProfile,
} from '@/lib/ai-payload-sanitizer';
import type { PatientProfile } from '@/types';

// ==================== TEST DATA ====================

function createMockPatient(overrides?: Partial<PatientProfile>): PatientProfile {
  return {
    id: 'test-123',
    name: 'Paula',
    age: 35,
    weight: 62,
    diagnosis: 'rak piersi',
    stage: '3b',
    molecularSubtype: 'luminal_a',
    surgeries: ['mastektomia', 'usunięcie podpachy'],
    currentChemo: 'AC/Paklitaksel',
    chemoCycle: '2/8',
    psychiatricMeds: [
      { name: 'Sertralin', genericName: 'sertraline', dose: '50mg', frequency: 'daily', startDate: '2026-01-01', cyp450: [], interactions: [], sideEffects: [], active: true },
    ],
    oncologyMeds: [
      { name: 'Taxol', genericName: 'paclitaxel', dose: '175mg/m2', frequency: 'q21d', startDate: '2026-02-01', cyp450: [], interactions: [], sideEffects: [], active: true },
    ],
    otherMeds: [
      { name: 'Omeprazol', genericName: 'omeprazole', dose: '20mg', frequency: 'daily', startDate: '2026-01-01', cyp450: [], interactions: [], sideEffects: [], active: true },
    ],
    allergies: [],
    preferences: [],
    pii: { firstName: 'Paula', lastName: 'Kowalska', pesel: '95123145670', address: 'ul. Kopernika 1, Warszawa', phone: '+48123456789', email: 'paula@example.com', hospitalIds: [] },
    displayName: 'Paula',
    diseaseProfileId: 'breast_cancer',
    location: { residenceCountry: 'Polska', treatmentCountry: 'Polska', treatmentFacility: 'Szpital Onkologiczny Warszawa', guidelineRegion: 'europe' },
    languages: { appLanguage: 'pl', documentLanguages: ['pl'], preferredMedicalTerms: 'pl' },
    erStatus: 'positive',
    prStatus: 'positive',
    her2Status: 'negative',
    breastCancerSubtype: 'luminal_a',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ==================== TESTS ====================

describe('sanitizePatientForAI', () => {
  it('removes displayName completely', () => {
    const patient = createMockPatient();
    const sanitized = sanitizePatientForAI(patient);

    expect(sanitized).not.toHaveProperty('displayName');
    expect(JSON.stringify(sanitized)).not.toContain('Paula');
  });

  it('abstracts age to decade: 35 → "30-40"', () => {
    const patient = createMockPatient({ age: 35 });
    const sanitized = sanitizePatientForAI(patient);

    expect(sanitized.ageDecade).toBe('30-40');
  });

  it('abstracts age to decade: 40 → "40-50"', () => {
    const patient = createMockPatient({ age: 40 });
    const sanitized = sanitizePatientForAI(patient);

    expect(sanitized.ageDecade).toBe('40-50');
  });

  it('abstracts age to decade: 29 → "20-30"', () => {
    const patient = createMockPatient({ age: 29 });
    const sanitized = sanitizePatientForAI(patient);

    expect(sanitized.ageDecade).toBe('20-30');
  });

  it('keeps clinical data: diagnosis, stage, subtypes', () => {
    const patient = createMockPatient();
    const sanitized = sanitizePatientForAI(patient);

    expect(sanitized.diagnosis).toBe('rak piersi');
    expect(sanitized.stage).toBe('3b');
    expect(sanitized.molecularSubtype).toBe('luminal_a');
  });

  it('keeps weight (needed for dosing)', () => {
    const patient = createMockPatient({ weight: 62 });
    const sanitized = sanitizePatientForAI(patient);

    expect(sanitized.weightKg).toBe(62);
  });

  it('converts trade names to INN for oncology meds', () => {
    const patient = createMockPatient({
      oncologyMeds: [
        { name: 'Taxol', genericName: 'paclitaxel', dose: '175mg/m2', frequency: 'q21d', startDate: '2026-02-01', cyp450: [], interactions: [], sideEffects: [], active: true },
      ],
    });
    const sanitized = sanitizePatientForAI(patient);

    expect(sanitized.oncologyMeds).toHaveLength(1);
    // drug-resolver may return either Polish (paklitaksel) or English (paclitaxel) INN
    expect(['paklitaksel', 'paclitaxel']).toContain(sanitized.oncologyMeds[0].inn);
    expect(sanitized.oncologyMeds[0].dose).toBe('175mg/m2');
  });

  it('abstracts psychiatricMeds to classes: Sertralin → SSRI', () => {
    const patient = createMockPatient({
      psychiatricMeds: [
        { name: 'Sertralin', genericName: 'sertraline', dose: '50mg', frequency: 'daily', startDate: '2026-01-01', cyp450: [], interactions: [], sideEffects: [], active: true },
      ],
    });
    const sanitized = sanitizePatientForAI(patient);

    expect(sanitized.psychiatricMedClasses).toContain('SSRI');
    expect(sanitized.psychiatricMedClasses).not.toContain('Sertralin');
    expect(sanitized.psychiatricMedClasses).not.toContain('50mg');
  });

  it('does NOT include treatmentFacility', () => {
    const patient = createMockPatient({
      location: { residenceCountry: 'Polska', treatmentCountry: 'Polska', treatmentFacility: 'Szpital Onkologiczny Warszawa', guidelineRegion: 'europe' },
    });
    const sanitized = sanitizePatientForAI(patient);

    expect(JSON.stringify(sanitized)).not.toContain('Szpital Onkologiczny');
  });

  it('maps treatmentCountry to guidelineRegion: Polska → ESMO', () => {
    const patient = createMockPatient({
      location: { residenceCountry: 'Polska', treatmentCountry: 'Polska', treatmentFacility: 'Szpital X', guidelineRegion: 'europe' },
    });
    const sanitized = sanitizePatientForAI(patient);

    expect(sanitized.guidelineRegion).toBe('ESMO');
  });

  it('maps treatmentCountry to guidelineRegion: USA → NCCN', () => {
    const patient = createMockPatient({
      location: { residenceCountry: 'USA', treatmentCountry: 'USA', guidelineRegion: 'usa' },
    });
    const sanitized = sanitizePatientForAI(patient);

    expect(sanitized.guidelineRegion).toBe('NCCN');
  });

  it('does NOT mutate original PatientProfile', () => {
    const patient = createMockPatient();
    const patientBefore = JSON.stringify(patient);

    sanitizePatientForAI(patient);

    expect(JSON.stringify(patient)).toBe(patientBefore);
  });

  it('includes appLanguage in sanitized profile', () => {
    const patient = createMockPatient({
      languages: { appLanguage: 'en', documentLanguages: ['en'], preferredMedicalTerms: 'en' },
    });
    const sanitized = sanitizePatientForAI(patient);

    expect(sanitized.appLanguage).toBe('en');
  });
});

describe('resolveGuidelineRegion', () => {
  it('maps European countries to ESMO', () => {
    expect(resolveGuidelineRegion('PL')).toBe('ESMO');
    expect(resolveGuidelineRegion('DE')).toBe('ESMO');
    expect(resolveGuidelineRegion('FR')).toBe('ESMO');
    expect(resolveGuidelineRegion('Polska')).toBe('ESMO');
  });

  it('maps North American countries to NCCN', () => {
    expect(resolveGuidelineRegion('US')).toBe('NCCN');
    expect(resolveGuidelineRegion('CA')).toBe('NCCN');
  });

  it('defaults to ESMO for undefined country', () => {
    expect(resolveGuidelineRegion()).toBe('ESMO');
  });

  it('returns "both" for unknown country', () => {
    expect(resolveGuidelineRegion('ZZ')).toBe('both');
  });
});

describe('resolvePsychiatricDrugClass', () => {
  it('resolves SSRI: Sertralin → SSRI', () => {
    expect(resolvePsychiatricDrugClass('Sertralin')).toBe('SSRI');
    expect(resolvePsychiatricDrugClass('sertralin')).toBe('SSRI');
  });

  it('resolves SNRI: Wenlafaksyna → SNRI', () => {
    expect(resolvePsychiatricDrugClass('Wenlafaksyna')).toBe('SNRI');
  });

  it('resolves benzos: Alprazolam → benzodiazepina', () => {
    expect(resolvePsychiatricDrugClass('Alprazolam')).toBe('benzodiazepina');
  });

  it('handles "FirstWord Dose" format: "Sertralin 50mg" → SSRI', () => {
    expect(resolvePsychiatricDrugClass('Sertralin 50mg')).toBe('SSRI');
  });

  it('returns null for unknown psychiatric drug', () => {
    expect(resolvePsychiatricDrugClass('UnknownDrugXYZ')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(resolvePsychiatricDrugClass('')).toBeNull();
  });
});

describe('formatChemoDrugForAI', () => {
  it('formats trade name: Taxol → "paklitaksel (Taxol)"', () => {
    const formatted = formatChemoDrugForAI('Taxol');
    // drug-resolver may return either Polish (paklitaksel) or English (paclitaxel) INN
    expect(['paklitaksel', 'paclitaxel']).toContain(formatted.split(' ')[0]);
    expect(formatted).toContain('Taxol');
  });

  it('returns as-is for unknown drug', () => {
    const formatted = formatChemoDrugForAI('UnknownChemoDrug');
    expect(formatted).toBe('UnknownChemoDrug');
  });

  it('handles case-insensitive match: "taxol" → "paklitaksel (taxol)"', () => {
    const formatted = formatChemoDrugForAI('taxol');
    // drug-resolver may return either Polish (paklitaksel) or English (paclitaxel) INN
    expect(['paklitaksel', 'paclitaxel']).toContain(formatted.split(' ')[0]);
  });
});

describe('SanitizedAIProfile type safety', () => {
  it('all required fields are present after sanitization', () => {
    const patient = createMockPatient();
    const sanitized = sanitizePatientForAI(patient);

    const requiredFields = [
      'ageDecade',
      'weightKg',
      'diagnosis',
      'stage',
      'oncologyMeds',
      'otherMeds',
      'psychiatricMedClasses',
      'guidelineRegion',
      'appLanguage',
    ];

    for (const field of requiredFields) {
      expect(sanitized).toHaveProperty(field);
    }
  });

  it('sensitive fields are completely absent', () => {
    const patient = createMockPatient();
    const sanitized = sanitizePatientForAI(patient);
    const sanitizedStr = JSON.stringify(sanitized);

    // Should NOT contain original identifiers
    expect(sanitizedStr).not.toContain('Paula');
    expect(sanitizedStr).not.toContain('Kowalska');
    expect(sanitizedStr).not.toContain('Szpital');
    expect(sanitizedStr).not.toContain('Warszawa');
  });
});
