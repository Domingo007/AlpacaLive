import { describe, it, expect } from 'vitest';
import { getEventColors } from '@/lib/calendar-events';

describe('getEventColors — localized labels', () => {
  describe('German (de)', () => {
    const colors = getEventColors('de');

    it('chemo type has German label', () => {
      expect(colors.chemo.label).toBe('Chemotherapie');
    });

    it('blood_test has German label "Blutwerte"', () => {
      expect(colors.blood_test.label).toBe('Blutwerte');
    });

    it('supplement has German label "Ergänzungen"', () => {
      expect(colors.supplement.label).toBe('Ergänzungen');
    });

    it('daily_log has German label "Tagebuch"', () => {
      expect(colors.daily_log.label).toBe('Tagebuch');
    });

    it('imaging has German label "Bildgebung"', () => {
      expect(colors.imaging.label).toBe('Bildgebung');
    });

    it('doctor_visit has German label "Arztbesuch"', () => {
      expect(colors.doctor_visit.label).toBe('Arztbesuch');
    });

    it('radiotherapy_session has German label', () => {
      expect(colors.radiotherapy_session.label).toBe('Strahlentherapie');
    });

    it('immunotherapy_infusion has German label', () => {
      expect(colors.immunotherapy_infusion.label).toBe('Immuntherapie');
    });

    it('hormonal_therapy has German label', () => {
      expect(colors.hormonal_therapy.label).toBe('Hormontherapie');
    });

    it('surgery has German label "Operation"', () => {
      expect(colors.surgery.label).toBe('Operation');
    });

    it('no German label contains Polish diacritics', () => {
      const offenders: string[] = [];
      for (const [key, val] of Object.entries(colors)) {
        if (/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(val.label)) {
          offenders.push(`${key}: ${val.label}`);
        }
      }
      expect(offenders).toEqual([]);
    });

    it('colors and icons preserved from default config', () => {
      expect(colors.chemo.color).toBe('#e74c3c');
      expect(colors.chemo.icon).toBe('vaccines');
      expect(colors.blood_test.icon).toBe('water_drop');
    });
  });

  describe('English (en)', () => {
    const colors = getEventColors('en');

    it('chemo has English label "Chemotherapy"', () => {
      expect(colors.chemo.label).toBe('Chemotherapy');
    });

    it('blood_test has "Blood results"', () => {
      expect(colors.blood_test.label).toBe('Blood results');
    });

    it('supplement has "Supplements"', () => {
      expect(colors.supplement.label).toBe('Supplements');
    });

    it('daily_log has "Journal"', () => {
      expect(colors.daily_log.label).toBe('Journal');
    });

    it('no English label contains Polish diacritics', () => {
      const offenders: string[] = [];
      for (const [key, val] of Object.entries(colors)) {
        if (/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(val.label)) {
          offenders.push(`${key}: ${val.label}`);
        }
      }
      expect(offenders).toEqual([]);
    });
  });

  describe('Polish (pl) — original labels preserved', () => {
    const colors = getEventColors('pl');

    it('chemo has "Chemioterapia"', () => {
      expect(colors.chemo.label).toBe('Chemioterapia');
    });

    it('supplement has "Suplementy"', () => {
      expect(colors.supplement.label).toBe('Suplementy');
    });

    it('daily_log has "Dziennik"', () => {
      expect(colors.daily_log.label).toBe('Dziennik');
    });
  });

  describe('default (no lang)', () => {
    it('defaults to Polish', () => {
      const colors = getEventColors();
      expect(colors.chemo.label).toBe('Chemioterapia');
    });
  });

  describe('all 23 event types covered in all 3 languages', () => {
    const expectedTypes = [
      'chemo', 'chemo_postponed', 'blood_test', 'imaging', 'daily_log',
      'supplement', 'doctor_visit', 'side_effect', 'weight', 'wearable_alert',
      'prediction', 'medication_change', 'note', 'radiotherapy_session',
      'immunotherapy_infusion', 'targeted_therapy', 'hormonal_therapy',
      'surgery', 'surgery_followup', 'recovery_period',
      'phase_a', 'phase_b', 'phase_c',
    ];

    for (const lang of ['pl', 'en', 'de'] as const) {
      it(`${lang} has all ${expectedTypes.length} event types with non-empty labels`, () => {
        const colors = getEventColors(lang);
        for (const type of expectedTypes) {
          expect((colors as any)[type]).toBeDefined();
          expect((colors as any)[type].label).toBeTruthy();
        }
      });
    }
  });
});
