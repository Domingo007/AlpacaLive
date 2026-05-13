import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage, PatientProfile } from '@/types';
import { getChatMessages, addChatMessage, updateChatMessage, getSettings, getPatient, getRecentDailyLogs, getRecentBloodWork, getRecentWearableData, getRecentMeals, getRecentChemo, getRecentImaging, getRecentPredictions, getRecentSupplements } from '@/lib/db';
import { sendMessage, getWelcomeMessage } from '@/lib/ai';
import { buildSystemPrompt } from '@/lib/system-prompt';
import { sanitizePatientForAI, formatChemoDrugForAI } from '@/lib/ai-payload-sanitizer';
import { extractDataFromResponse, extractAIProfileData, saveExtractedData, cleanResponseFromTags } from '@/lib/data-extractor';
import { generatePatternSummary, savePatternSummary, formatPatternForChat, checkPatternMatch, type PatternResult } from '@/lib/pattern-engine';
import { detectUnknownDrugs } from '@/lib/medical-data/drug-resolver';
import { filterNewUnknowns } from '@/lib/medical-data/unknown-drug-feedback';
import { useI18n } from '@/lib/i18n';

const PATTERN_TRIGGERS = ['wzorzec', 'wzorce', 'wzorcow', 'jak zwykle', 'pokaż wzorzec', 'pokaz wzorzec', 'predykcja', 'prognoza', 'przewiduj', 'jak będę się czuć', 'jak bede sie czuc', 'jak będę', 'co mnie czeka', 'najbliższe dni', 'ten tydzień', 'ten tydzien'];

function isPatternRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return PATTERN_TRIGGERS.some(t => lower.includes(t));
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPrediction, setLastPrediction] = useState<PatternResult | null>(null);
  const [lastProviderInfo, setLastProviderInfo] = useState<{ provider: string; model: string } | null>(null);
  const [unknownDrugs, setUnknownDrugs] = useState<string[]>([]);
  const [reportedDrugs, setReportedDrugs] = useState<Set<string>>(new Set());
  const { lang } = useI18n();

  useEffect(() => {
    loadMessages();
  }, []);

  // Refresh stale welcome message when language changes.
  // Replaces the first message only if it is the auto-welcome in the OTHER language
  // (matches PL or EN welcome verbatim). Does not touch user messages or real AI replies.
  useEffect(() => {
    const plWelcome = getWelcomeMessage('pl');
    const enWelcome = getWelcomeMessage('en');
    const currentWelcome = getWelcomeMessage(lang);
    if (messages.length === 0) return;
    const first = messages[0];
    if (first.role !== 'assistant') return;
    if (typeof first.content !== 'string') return;
    if (first.content === currentWelcome) return;
    if (first.content !== plWelcome && first.content !== enWelcome) return;
    const refreshed = { ...first, content: currentWelcome };
    updateChatMessage(refreshed).then(() => {
      setMessages(prev => prev.length > 0 ? [refreshed, ...prev.slice(1)] : prev);
    });
  }, [lang, messages]);

  async function loadMessages() {
    const msgs = await getChatMessages(50);
    if (msgs.length === 0) {
      const welcome: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: getWelcomeMessage(lang),
        timestamp: new Date(),
      };
      await addChatMessage(welcome);
      setMessages([welcome]);
    } else {
      setMessages(msgs);
    }
  }

  const send = useCallback(async (text: string, images?: { base64: string; mediaType: string }[]) => {
    setError(null);

    const content: ChatMessage['content'] = images && images.length > 0
      ? [
          { type: 'text' as const, text },
          ...images.map(img => ({
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: img.mediaType, data: img.base64 },
          })),
        ]
      : text;

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    await addChatMessage(userMessage);
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    const detected = detectUnknownDrugs(typeof content === 'string' ? content : text);
    if (detected.length > 0) {
      const fresh = filterNewUnknowns(detected, reportedDrugs);
      if (fresh.length > 0) setUnknownDrugs(fresh);
    }

    try {
      const userText = typeof content === 'string' ? content : text;

      // Check for pattern analysis request — handle locally
      if (isPatternRequest(userText)) {
        const predResult = await generatePatternSummary();
        setLastPrediction(predResult);

        if (!predResult.insufficientData) {
          await savePatternSummary(predResult);
        }

        // Also check past pattern match accuracy
        const accuracyCheck = await checkPatternMatch();

        let responseText = formatPatternForChat(predResult);
        if (accuracyCheck) {
          // TODO: przenieś do translations/pl.ts zamiast hardcode
          responseText += `\n\n🎯 **Trafność poprzednich analiz wzorców:** ${accuracyCheck.overallAccuracy}%`;
        }

        const assistantMessage: ChatMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: responseText,
          timestamp: new Date(),
        };
        await addChatMessage(assistantMessage);
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
        return;
      }

      // Regular AI flow
      const settings = await getSettings();
      const patient = await getPatient();

      let systemPrompt = lang === 'en'
        ? 'You are the AlpacaLive medical agent. You help an oncology patient. Always reply in English.'
        : 'Jesteś agentem medycznym AlpacaLive. Pomagasz pacjentowi onkologicznemu. Mów po polsku.';

      if (patient) {
        const [daily, blood, wearable, meals, chemo, imaging, predictions, supplements] = await Promise.all([
          getRecentDailyLogs(),
          getRecentBloodWork(),
          getRecentWearableData(),
          getRecentMeals(),
          getRecentChemo(),
          getRecentImaging(),
          getRecentPredictions(),
          getRecentSupplements(),
        ]);
        // Override patient appLanguage with current UI language so the AI always
        // replies in the language the user is reading the app in.
        const patientForPrompt = patient.languages
          ? { ...patient, languages: { ...patient.languages, appLanguage: lang } }
          : { ...patient, languages: { appLanguage: lang, documentLanguages: [lang], preferredMedicalTerms: lang } };

        // Sanitize patient profile for AI payload (removes identifiers, abstracts PII)
        const sanitizedProfile = sanitizePatientForAI(patientForPrompt);

        // Format chemo drugs: convert trade names to INN
        const chemoWithFormattedDrugs = chemo.map(session => ({
          ...session,
          drugs: session.drugs.map(formatChemoDrugForAI),
        }));

        systemPrompt = buildSystemPrompt(
          sanitizedProfile,
          { daily, blood, wearable, meals, chemo: chemoWithFormattedDrugs, imaging, predictions, supplements },
          patient.diseaseProfileId,
        );
      }

      const allMessages = [...messages, userMessage];
      const response = await sendMessage(allMessages, {
        apiKey: settings?.apiKey || '',
        provider: (settings?.aiProvider as any) || 'anthropic',
        systemPrompt,
        piiData: patient?.pii,
        lang,
      });

      // Extract and save structured data from response
      const extracted = extractDataFromResponse(response.content);
      if (extracted.length > 0) {
        await saveExtractedData(extracted);
      }

      // Extract AI clinical profile data (scores with basis, clinical findings)
      extractAIProfileData(response.content);

      const cleanContent = cleanResponseFromTags(response.content);
      setLastProviderInfo({ provider: response.provider, model: response.model });

      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: cleanContent,
        timestamp: new Date(),
        dataExtracted: extracted.length > 0 ? extracted.map(e => e.data) : undefined,
      };

      await addChatMessage(assistantMessage);
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Nieznany błąd';
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [messages, reportedDrugs, lang]);

  const dismissUnknownDrugs = useCallback(() => {
    setReportedDrugs(prev => {
      const next = new Set(prev);
      for (const d of unknownDrugs) next.add(d.toLowerCase());
      return next;
    });
    setUnknownDrugs([]);
  }, [unknownDrugs]);

  return {
    messages,
    isLoading,
    error,
    send,
    reload: loadMessages,
    lastPrediction,
    lastProviderInfo,
    unknownDrugs,
    dismissUnknownDrugs,
  };
}
