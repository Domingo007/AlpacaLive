import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../lib/system-prompt';
import type { PatientProfile } from '@/types';

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
};

const testData = { daily: [], blood: [], wearable: [], meals: [], chemo: [], imaging: [], predictions: [] };

describe('System Prompt — Unknown Drug Handling', () => {
  const prompt = buildSystemPrompt(testPatient, testData);

  it('includes explicit instruction for unknown medications', () => {
    expect(prompt).toMatch(/NOT present.*knowledge base/i);
    expect(prompt).toMatch(/acknowledge.*not in.*database/i);
  });

  it('directs users to feedback system for unknown items', () => {
    expect(prompt).toMatch(/Feedback.*Ideas|report.*missing/i);
  });

  it('prohibits specific dosing for unknown drugs', () => {
    expect(prompt).toMatch(/NOT provide specific dosing/i);
  });
});
