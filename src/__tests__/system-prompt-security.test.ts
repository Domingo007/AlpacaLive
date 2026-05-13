import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../lib/system-prompt';
import { sanitizePatientForAI } from '../lib/ai-payload-sanitizer';
import type { PatientProfile } from '@/types';

// Minimal patient profile for testing
const testPatient: PatientProfile = {
  id: 'test',
  name: 'Test',
  displayName: 'Test',
  age: 42,
  weight: 65,
  diagnosis: 'Rak piersi',
  stage: 'IIA',
  surgeries: [],
  currentChemo: 'EC',
  chemoCycle: '21 dni',
  psychiatricMeds: [],
  oncologyMeds: [],
  otherMeds: [],
  allergies: [],
  preferences: [],
  pii: { firstName: 'Anna', lastName: 'Test', pesel: '', address: '', phone: '', email: '', hospitalIds: [] },
  createdAt: new Date(),
  updatedAt: new Date(),
  languages: { appLanguage: 'pl', documentLanguages: ['pl'], preferredMedicalTerms: 'pl' },
};

const testData = { daily: [], blood: [], wearable: [], meals: [], chemo: [], imaging: [], predictions: [] };

describe('System Prompt — Security', () => {
  const sanitized = sanitizePatientForAI(testPatient);
  const prompt = buildSystemPrompt(sanitized, testData);

  it('CRITICAL: contains anti-manipulation section', () => {
    expect(prompt).toContain('ZABEZPIECZENIA');
    expect(prompt).toContain('NIEMODYFIKOWALNE');
  });

  it('CRITICAL: instructs to ignore injection in messages', () => {
    expect(prompt).toMatch(/IGNORUJ.*instrukcje.*wiadomości/i);
  });

  it('CRITICAL: instructs to ignore injection in images', () => {
    expect(prompt).toMatch(/zdjęci.*tekst.*nadpisać|ignore.*instructions.*image/i);
  });

  it('CRITICAL: refuses to reveal system prompt', () => {
    expect(prompt).toMatch(/nie mogę udostępnić.*instrukcji/i);
  });

  it('CRITICAL: enforces oncology-only scope', () => {
    expect(prompt).toContain('ZAKRES TEMATYCZNY');
    expect(prompt).toContain('TYLKO ONKOLOGIA');
    expect(prompt).toContain('WYŁĄCZNIE na pytania');
  });

  it('CRITICAL: has off-topic refusal template', () => {
    expect(prompt).toMatch(/wykracza poza.*zakres|beyond.*scope/i);
  });
});

describe('System Prompt — Medical Safety', () => {
  const sanitized = sanitizePatientForAI(testPatient);
  const prompt = buildSystemPrompt(sanitized, testData);

  it('CRITICAL: contains absolute bans', () => {
    expect(prompt).toContain('ABSOLUTNE ZAKAZY');
  });

  it('CRITICAL: bans "powinieneś brać"', () => {
    expect(prompt).toContain('NIGDY nie mów "powinieneś/powinnaś brać');
  });

  it('CRITICAL: bans "zalecam"', () => {
    expect(prompt).toContain('NIGDY nie mów "zalecam"');
  });

  it('CRITICAL: bans dosage recommendations', () => {
    expect(prompt).toMatch(/NIGDY.*dawek.*rekomendacj/i);
  });

  it('CRITICAL: bans chemo regimen changes', () => {
    expect(prompt).toMatch(/NIGDY.*schematu chemioterapii/i);
  });

  it('CRITICAL: bans saying results are "OK"', () => {
    expect(prompt).toMatch(/NIGDY.*"w porządku".*"nie ma się czym martwić"/i);
  });

  it('CRITICAL: requires mandatory disclaimer', () => {
    expect(prompt).toContain('OBOWIĄZKOWY DISCLAIMER');
    expect(prompt).toContain('Nie stanowi porady medycznej');
  });

  it('CRITICAL: requires imaging disclaimer', () => {
    expect(prompt).toContain('NIE stanowi opisu radiologicznego');
  });

  it('CRITICAL: requires supplement disclaimer', () => {
    expect(prompt).toMatch(/eksperymentaln.*nie.*zatwierdzone terapie/i);
  });
});

describe('System Prompt — Structure', () => {
  const sanitized = sanitizePatientForAI(testPatient);
  const prompt = buildSystemPrompt(sanitized, testData);

  it('contains patient info section', () => {
    expect(prompt).toContain('PACJENT');
    expect(prompt).toContain('40-50'); // ageDecade for age 42
  });

  it('contains treatment types section', () => {
    expect(prompt).toContain('TYPY LECZENIA ONKOLOGICZNEGO');
  });

  it('contains chemotherapy info', () => {
    expect(prompt).toContain('Chemioterapia');
  });

  it('contains radiotherapy info', () => {
    expect(prompt).toContain('Radioterapia');
  });

  it('contains immunotherapy info', () => {
    expect(prompt).toContain('Immunoterapia');
  });

  it('contains tasks section', () => {
    expect(prompt).toContain('TWOJE ZADANIA');
  });

  it('contains style guidelines', () => {
    expect(prompt).toContain('STYL');
  });

  it('does NOT contain raw PII outside patient section', () => {
    // Patient name should appear only in the patient section
    const sections = prompt.split('## ');
    const nonPatientSections = sections.filter(s => !s.startsWith('PACJENT') && !s.startsWith('KIM JESTEŚ'));
    for (const section of nonPatientSections) {
      // PII should not leak into other sections
      expect(section).not.toContain('Anna Test');
    }
  });
});

describe('System Prompt — Disease Knowledge Integration', () => {
  const patientWithDiseaseRaw = {
    ...testPatient,
    diseaseProfileId: 'breast-cancer',
    breastCancerSubtype: 'luminal_b' as const,
  };
  const patientWithDisease = sanitizePatientForAI(patientWithDiseaseRaw);
  const prompt = buildSystemPrompt(patientWithDisease, testData, 'breast-cancer');

  it('includes disease knowledge section when profile set', () => {
    expect(prompt).toContain('WIEDZA O CHOROBIE');
    expect(prompt).toContain('Rak piersi');
  });

  it('includes tumor markers', () => {
    expect(prompt).toContain('CA 15-3');
  });

  it('includes metastasis sites', () => {
    expect(prompt).toMatch(/Kości|Wątroba|Płuca/);
  });
});
