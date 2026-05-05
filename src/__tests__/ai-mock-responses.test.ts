import { describe, it, expect } from 'vitest';
import { getWelcomeMessage, sendMessage } from '../lib/ai';
import type { ChatMessage } from '@/types';

function userMsg(text: string): ChatMessage {
  return { id: 't', role: 'user', content: text, timestamp: new Date() };
}

describe('chat demo data — bilingual', () => {
  describe('getWelcomeMessage', () => {
    it('returns Polish welcome by default', () => {
      const msg = getWelcomeMessage();
      expect(msg).toMatch(/Dzień dobry/);
    });

    it('returns Polish welcome when lang=pl', () => {
      expect(getWelcomeMessage('pl')).toMatch(/Dzień dobry/);
    });

    it('returns English welcome when lang=en', () => {
      const msg = getWelcomeMessage('en');
      expect(msg).toMatch(/Hello/);
      expect(msg).not.toMatch(/Dzień dobry/);
    });
  });

  describe('mock responses via sendMessage (no API key)', () => {
    const baseConfig = { apiKey: '', provider: 'anthropic' as const, systemPrompt: '' };

    it('PL keyword triggers PL response', async () => {
      const res = await sendMessage([userMsg('Daj mi raport dla lekarza')], { ...baseConfig, lang: 'pl' });
      expect(res.content).toMatch(/Raport dla lekarza/);
    });

    it('EN keyword triggers EN response', async () => {
      const res = await sendMessage([userMsg('Give me a report for the doctor')], { ...baseConfig, lang: 'en' });
      expect(res.content).toMatch(/Report for doctor/);
    });

    it('EN fallback when no keyword matches', async () => {
      const res = await sendMessage([userMsg('Just a general question')], { ...baseConfig, lang: 'en' });
      expect(res.content).toMatch(/demo mode/i);
      expect(res.content).not.toMatch(/W trybie demo/);
    });

    it('PL fallback when no keyword matches', async () => {
      const res = await sendMessage([userMsg('Pytanie ogólne')], { ...baseConfig, lang: 'pl' });
      expect(res.content).toMatch(/W trybie demo/);
    });

    it('defaults to Polish when lang not supplied', async () => {
      const res = await sendMessage([userMsg('Daj raport')], baseConfig);
      expect(res.content).toMatch(/Raport dla lekarza/);
    });

    it('EN chemo keyword maps to chemo response', async () => {
      const res = await sendMessage([userMsg('I had chemo today')], { ...baseConfig, lang: 'en' });
      expect(res.content).toMatch(/chemo today/i);
    });

    it('EN imaging keyword maps to imaging response', async () => {
      const res = await sendMessage([userMsg('Can you analyze my MRI?')], { ...baseConfig, lang: 'en' });
      expect(res.content).toMatch(/Imaging analysis/);
    });
  });
});
