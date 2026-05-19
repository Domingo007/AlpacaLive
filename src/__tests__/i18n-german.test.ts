import { describe, it, expect } from 'vitest';
import { pl } from '../lib/translations/pl';
import { en } from '../lib/translations/en';
import { de } from '../lib/translations/de';

describe('German (de) translations', () => {
  describe('structural completeness', () => {
    it('de.ts has the same top-level section keys as pl.ts', () => {
      const plKeys = Object.keys(pl).sort();
      const deKeys = Object.keys(de).sort();
      expect(deKeys).toEqual(plKeys);
    });

    it('de.ts has the same top-level section keys as en.ts', () => {
      const enKeys = Object.keys(en).sort();
      const deKeys = Object.keys(de).sort();
      expect(deKeys).toEqual(enKeys);
    });

    it('all values in de.common are German (not Polish or English)', () => {
      expect(de.common.loading).toBe('Wird geladen...');
      expect(de.common.save).toBe('Speichern');
      expect(de.common.cancel).toBe('Abbrechen');
      expect(de.common.yes).toBe('Ja');
      expect(de.common.no).toBe('Nein');
    });

    it('de.settings includes all critical keys', () => {
      expect(de.settings.title).toBe('Einstellungen');
      expect(de.settings.language).toBe('Sprache');
      expect(de.settings.demoMode).toBe('Demo-Modus');
      expect(de.settings.loadDemo).toBe('Demodaten laden');
      expect(de.settings.exitDemo).toBe('Demo-Modus verlassen');
      expect(de.settings.aiMode).toBe('Mit KI-Agent');
    });

    it('de.aiProvider has German labels', () => {
      expect(de.aiProvider.title).toBe('KI-Modell');
      expect(de.aiProvider.apiKey).toBe('API-Schlüssel');
      expect(de.aiProvider.testing).toMatch(/Verbindung wird getestet/);
    });

    it('de.calendar.eventTypes are translated to German', () => {
      expect(de.calendar.eventTypes.chemo).toBe('Chemotherapie');
      expect(de.calendar.eventTypes.blood_test).toBe('Bluttest');
      expect(de.calendar.eventTypes.imaging).toBe('Bildgebung');
      expect(de.calendar.eventTypes.surgery).toBe('Operation');
      expect(de.calendar.eventTypes.radiotherapy_session).toBe('Strahlentherapie');
    });

    it('de.education has full German translations', () => {
      expect(de.education.title).toBe('Patientenedukation');
      expect(de.education.glossary).toBe('Medizinisches Glossar');
      expect(de.education.whenToCall).toBe('Wann den Arzt anrufen');
      expect(de.education.sideEffects).toBe('Umgang mit Nebenwirkungen');
    });

    it('de.update and de.migration are German', () => {
      expect(de.update.available).toBe('Neue Version von AlpacaLive');
      expect(de.update.updateNow).toBe('Jetzt aktualisieren');
      expect(de.migration.updating).toMatch(/Aktualisierung/);
      expect(de.migration.done).toBe('Daten erhalten');
    });
  });

  describe('lambda translations', () => {
    it('de.common.inDays produces German output', () => {
      expect(de.common.inDays(3)).toBe('In 3 Tagen');
      expect(de.common.inDays(1)).toBe('In 1 Tagen');
    });

    it('de.settings.privacyNote substitutes name correctly', () => {
      expect(de.settings.privacyNote('Anna')).toMatch(/Anna/);
      expect(de.settings.privacyNote('Anna')).toMatch(/Diese Daten verlassen nie Ihr Gerät/);
    });

    it('de.supplements.title formats taken/total', () => {
      expect(de.supplements.title(3, 5)).toBe('Ergänzungen (3/5)');
    });

    it('de.predictions.dayOfCycle generates German label', () => {
      expect(de.predictions.dayOfCycle(7)).toBe('Tag 7 des Zyklus');
    });

    it('de.imaging.photos handles plural correctly', () => {
      expect(de.imaging.photos(1)).toBe('1 Foto');
      expect(de.imaging.photos(3)).toBe('3 Fotos');
    });

    it('de.historicalImport.manualDesc switches by boolean', () => {
      expect(de.historicalImport.manualDesc(true)).toMatch(/Vollständiger Markerbereich/);
      expect(de.historicalImport.manualDesc(false)).toMatch(/Grundlegende Marker/);
    });

    it('de.onboarding.agentWillCall substitutes name', () => {
      expect(de.onboarding.agentWillCall('Anna')).toBe('Der Agent wird Sie "Anna" nennen.');
    });
  });

  describe('no Polish leftovers in German strings', () => {
    function hasPolishChars(s: string): boolean {
      return /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(s);
    }

    function walk(obj: any, path = ''): string[] {
      const offenders: string[] = [];
      if (typeof obj === 'string') {
        if (hasPolishChars(obj)) offenders.push(`${path}: "${obj}"`);
      } else if (Array.isArray(obj)) {
        obj.forEach((v, i) => offenders.push(...walk(v, `${path}[${i}]`)));
      } else if (obj && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) {
          if (typeof v === 'function') continue; // lambdas tested separately
          offenders.push(...walk(v, path ? `${path}.${k}` : k));
        }
      }
      return offenders;
    }

    it('no Polish diacritical characters in any de.ts string value', () => {
      const offenders = walk(de);
      expect(offenders).toEqual([]);
    });
  });

  describe('weekDays arrays', () => {
    it('de.historicalImport.weekDays starts with Mo (Monday)', () => {
      expect(de.historicalImport.weekDays[0]).toBe('Mo');
      expect(de.historicalImport.weekDays[1]).toBe('Di');
      expect(de.historicalImport.weekDays).toHaveLength(7);
    });

    it('de.calendar.weekDays starts with Mo (Monday)', () => {
      expect(de.calendar.weekDays[0]).toBe('Mo');
      expect(de.calendar.weekDays[6]).toBe('So');
    });
  });

  describe('imaging body regions are German', () => {
    it('all body regions translated', () => {
      expect(de.imaging.bodyRegions.chest).toBe('Brustkorb');
      expect(de.imaging.bodyRegions.abdomen).toBe('Bauchhöhle');
      expect(de.imaging.bodyRegions.breasts).toBe('Brüste');
    });
  });
});
