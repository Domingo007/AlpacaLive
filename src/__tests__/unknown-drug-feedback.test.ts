import { describe, it, expect } from 'vitest';
import { buildUnknownDrugIssueUrl, filterNewUnknowns } from '../lib/medical-data/unknown-drug-feedback';

describe('unknown drug feedback helpers', () => {
  describe('buildUnknownDrugIssueUrl', () => {
    it('targets the correct repo and uses the medical_data template + label', () => {
      const url = buildUnknownDrugIssueUrl(['Xyzabc'], { language: 'pl', context: 'chat' });
      expect(url).toMatch(/^https:\/\/github\.com\/Domingo007\/AlpacaLive\/issues\/new\?/);
      expect(url).toContain('template=medical_data.md');
      expect(url).toContain('labels=medical-knowledge');
    });

    it('includes drug names in title (PL prefix when language=pl)', () => {
      const url = buildUnknownDrugIssueUrl(['Xyzabc', 'NewDrug2'], { language: 'pl', context: 'form', formType: 'chemo' });
      const params = new URL(url).searchParams;
      const title = params.get('title') || '';
      expect(title).toContain('Brakujący lek');
      expect(title).toContain('Xyzabc');
      expect(title).toContain('NewDrug2');
    });

    it('includes drug names in title (EN prefix when language=en)', () => {
      const url = buildUnknownDrugIssueUrl(['Xyzabc'], { language: 'en', context: 'chat' });
      const params = new URL(url).searchParams;
      const title = params.get('title') || '';
      expect(title).toContain('Missing drug');
      expect(title).toContain('Xyzabc');
    });

    it('includes drugs as bulleted list and metadata in body', () => {
      const url = buildUnknownDrugIssueUrl(['Xyzabc', 'NewDrug2'], { language: 'pl', context: 'chat', aiProvider: 'anthropic' });
      const body = new URL(url).searchParams.get('body') || '';
      expect(body).toContain('- Xyzabc');
      expect(body).toContain('- NewDrug2');
      expect(body).toContain('**App version:**');
      expect(body).toContain('**Language:** PL');
      expect(body).toContain('**AI Provider:** anthropic');
      expect(body).toContain('**Timestamp:**');
    });

    it('chat and form contexts produce different body context lines', () => {
      const chatUrl = buildUnknownDrugIssueUrl(['X'], { language: 'en', context: 'chat' });
      const formUrl = buildUnknownDrugIssueUrl(['X'], { language: 'en', context: 'form', formType: 'hormonal' });
      const chatBody = new URL(chatUrl).searchParams.get('body') || '';
      const formBody = new URL(formUrl).searchParams.get('body') || '';
      expect(chatBody).toContain('mentioned this drug in chat');
      expect(formBody).toContain('entered this drug in form (hormonal)');
    });

    it('omits AI Provider line when not supplied', () => {
      const url = buildUnknownDrugIssueUrl(['X'], { language: 'pl', context: 'form', formType: 'chemo' });
      const body = new URL(url).searchParams.get('body') || '';
      expect(body).not.toContain('**AI Provider:**');
    });
  });

  describe('filterNewUnknowns', () => {
    it('returns full list when nothing has been reported', () => {
      const out = filterNewUnknowns(['Xyzabc', 'NewDrug2'], new Set());
      expect(out).toEqual(['Xyzabc', 'NewDrug2']);
    });

    it('excludes already-reported drugs (case-insensitive)', () => {
      const out = filterNewUnknowns(['Xyzabc', 'NewDrug2'], new Set(['xyzabc']));
      expect(out).toEqual(['NewDrug2']);
    });

    it('returns empty when all detected drugs are already reported', () => {
      const out = filterNewUnknowns(['Xyzabc', 'NewDrug2'], new Set(['xyzabc', 'newdrug2']));
      expect(out).toEqual([]);
    });

    it('deduplicates within the detected list', () => {
      const out = filterNewUnknowns(['Xyzabc', 'XYZABC', 'NewDrug2'], new Set());
      expect(out).toEqual(['Xyzabc', 'NewDrug2']);
    });
  });
});
