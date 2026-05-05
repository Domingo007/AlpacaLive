import type { ChatMessage, MessageContent } from '@/types';
import { PIISanitizer, IMAGE_PII_INSTRUCTION } from './pii-sanitizer';
import type { PIIData } from '@/types';
import { sendToAI, getProviderLabel, type AIProvider, type AIMessage, type AIMessageContent } from './ai-provider';

export type ChatLang = 'pl' | 'en';

export interface AIConfig {
  apiKey: string;
  provider: AIProvider;
  systemPrompt: string;
  piiData?: PIIData;
  lang?: ChatLang;
}

export interface AIResponseResult {
  content: string;
  rawContent?: string;
  provider: AIProvider;
  model: string;
  piiRemoved: number;
}

const MOCK_RESPONSES: Record<ChatLang, Record<string, string>> = {
  pl: {
    default: 'Dzień dobry! Jestem narzędziem do analizy danych zdrowotnych AlpacaLive. Jak się dziś czujesz? Opowiedz mi o swoim samopoczuciu — energia, ból, nudności, nastrój.',
    morning: 'Dzień dobry! Jak się dzisiaj czujesz po przebudzeniu?\n\nPowiedz mi o:\n- Energia (1-10)\n- Ból (0-10)\n- Nudności (0-10)\n- Jak spałaś/spałeś?',
    evening: 'Czas na wieczorne podsumowanie. Jak minął dzień?\n\nOpowiedz o:\n- Energia pod koniec dnia\n- Co jadłaś/jadłeś?\n- Czy brałaś/brałeś suplementy?\n- Jak ogólnie nastrój?',
    chemo: 'Rozumiem, że miałeś/miała dziś chemię. To ważne żeby monitorować jak się czujesz.\n\nPowiedz mi:\n- Jakie leki podano?\n- Jak się czujesz teraz? (nudności, zmęczenie)\n- Czy jesteś dobrze nawodniona/y?',
    report: '## Raport dla lekarza\n\n**Okres:** ostatnie 7 dni\n\n**Trendy:**\n- Energia: brak danych (tryb demo)\n- Ból: brak danych\n- Waga: brak danych\n\n**Alerty:** Brak danych do analizy\n\n*Aby uzyskać pełny raport, dodaj klucz API w ustawieniach i wprowadź dane przez dziennik.*',
    prediction: '**Analiza wzorców** wymaga minimum 7 dni danych dziennika i 2 cykli chemii.\n\nZacznij od codziennego raportowania samopoczucia — gdy zbierze się wystarczająca ilość danych, pokażę jak zwykle wygląda dany dzień cyklu na podstawie Twoich wcześniejszych danych.',
    imaging: 'Analiza obrazowania wymaga klucza API.\n\nGdy dodasz klucz API, będę mógł:\n- Analizować zdjęcia RTG, CT, PET, MRI\n- Porównywać z poprzednimi badaniami\n- Śledzić zmiany rozmiarów guza (RECIST)',
    fallback: 'Dzięki za informacje! W trybie demo nie mogę w pełni analizować danych. Dodaj klucz API w ustawieniach, żeby odblokować pełną funkcjonalność.\n\nNa razie mogę Ci pomóc poruszać się po aplikacji — sprawdź zakładki Kalendarz, Dane, Obrazowanie i Ustawienia.',
  },
  en: {
    default: 'Hello! I\'m the AlpacaLive health data analysis tool. How are you feeling today? Tell me about your wellbeing — energy, pain, nausea, mood.',
    morning: 'Good morning! How are you feeling after waking up?\n\nTell me about:\n- Energy (1-10)\n- Pain (0-10)\n- Nausea (0-10)\n- How did you sleep?',
    evening: 'Time for an evening summary. How was your day?\n\nTell me about:\n- Energy at end of day\n- What did you eat?\n- Did you take your supplements?\n- Overall mood?',
    chemo: 'I understand you had chemo today. It\'s important to monitor how you\'re feeling.\n\nTell me:\n- Which drugs were given?\n- How do you feel now? (nausea, fatigue)\n- Are you well hydrated?',
    report: '## Report for doctor\n\n**Period:** last 7 days\n\n**Trends:**\n- Energy: no data (demo mode)\n- Pain: no data\n- Weight: no data\n\n**Alerts:** No data to analyze\n\n*To get a full report, add an API key in settings and enter data via the journal.*',
    prediction: '**Pattern analysis** requires at least 7 days of journal data and 2 chemo cycles.\n\nStart by logging your wellbeing daily — once enough data is collected, I\'ll show you what a given cycle day usually looks like based on your previous entries.',
    imaging: 'Imaging analysis requires an API key.\n\nOnce you add an API key, I will be able to:\n- Analyze X-ray, CT, PET, MRI images\n- Compare with previous studies\n- Track tumor size changes (RECIST)',
    fallback: 'Thanks for the information! In demo mode I can\'t fully analyze the data. Add an API key in settings to unlock full functionality.\n\nFor now I can help you navigate the app — check the Calendar, Data, Imaging and Settings tabs.',
  },
};

const MOCK_TRIGGERS: Record<ChatLang, Array<{ keys: string[]; response: string }>> = {
  pl: [
    { keys: ['raport', 'lekarz'], response: 'report' },
    { keys: ['predykcja', 'prognoza', 'przewiduj', 'wzorzec', 'wzorce'], response: 'prediction' },
    { keys: ['obrazowan', 'rtg', 'tomografi'], response: 'imaging' },
    { keys: ['chemi', 'chemiotera'], response: 'chemo' },
    { keys: ['rano', 'pobudz', 'dzien dobry'], response: 'morning' },
    { keys: ['wiecz', 'koniec dnia', 'dobranoc'], response: 'evening' },
  ],
  en: [
    { keys: ['report', 'doctor'], response: 'report' },
    { keys: ['pattern', 'prediction', 'forecast', 'predict'], response: 'prediction' },
    { keys: ['imaging', 'x-ray', 'xray', 'scan', 'mri', 'pet '], response: 'imaging' },
    { keys: ['chemo', 'chemotherapy'], response: 'chemo' },
    { keys: ['morning', 'good morning', 'wake up'], response: 'morning' },
    { keys: ['evening', 'end of day', 'good night', 'goodnight'], response: 'evening' },
  ],
};

function getMockResponse(userMessage: string, lang: ChatLang = 'pl'): string {
  const lower = typeof userMessage === 'string' ? userMessage.toLowerCase() : '';
  const dict = MOCK_RESPONSES[lang];
  for (const trigger of MOCK_TRIGGERS[lang]) {
    if (trigger.keys.some(k => lower.includes(k))) return dict[trigger.response];
  }
  return dict.fallback;
}

export async function sendMessage(
  messages: ChatMessage[],
  config: AIConfig,
): Promise<AIResponseResult> {
  const provider = config.provider || 'anthropic';

  if (!config.apiKey) {
    const lastMsg = messages[messages.length - 1];
    const userText = typeof lastMsg?.content === 'string' ? lastMsg.content : '';
    const resolvedLang = config.lang ?? 'pl';
    // Temporary diagnostic — remove after lang routing verified
    console.log('[AlpacaLive demo chat]', { configLang: config.lang, resolvedLang, userText: userText.slice(0, 60) });
    return { content: getMockResponse(userText, resolvedLang), provider, model: 'demo', piiRemoved: 0 };
  }

  const sanitizer = config.piiData ? new PIISanitizer(config.piiData) : null;
  let piiRemoved = 0;

  // Convert ChatMessages to AIMessages with PII sanitization
  const hasImages = messages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image'));

  const aiMessages: AIMessage[] = messages
    .filter(m => m.role !== 'system')
    .map(m => {
      if (typeof m.content === 'string') {
        const sanitized = sanitizer ? sanitizer.sanitizeOutgoing(m.content) : m.content;
        if (sanitized !== m.content) piiRemoved++;
        return { role: m.role, content: sanitized };
      }
      const parts: AIMessageContent[] = m.content.map(c => {
        if (c.type === 'text') {
          const sanitized = sanitizer ? sanitizer.sanitizeOutgoing(c.text) : c.text;
          if (sanitized !== c.text) piiRemoved++;
          return { type: 'text' as const, text: sanitized };
        }
        if (c.type === 'image') {
          return { type: 'image' as const, mimeType: c.source.media_type, data: c.source.data };
        }
        return { type: 'text' as const, text: '' };
      });
      return { role: m.role, content: parts };
    });

  const systemPrompt = (sanitizer ? sanitizer.sanitizeOutgoing(config.systemPrompt) : config.systemPrompt)
    + (hasImages ? '\n\n' + IMAGE_PII_INSTRUCTION : '');

  console.log(`[PII Sanitizer] Usunięto ${piiRemoved} dopasowań`);
  console.log(`[API] Wysyłam do: ${provider}`);

  const result = await sendToAI(
    { provider, apiKey: config.apiKey },
    systemPrompt,
    aiMessages,
    hasImages,
  );

  console.log(`[API] Odpowiedź: ${result.text.length} znaków, model: ${result.model}`);

  const content = sanitizer ? sanitizer.restoreIncoming(result.text) : result.text;

  return {
    content,
    rawContent: result.text,
    provider: result.provider,
    model: result.model,
    piiRemoved,
  };
}

export function getWelcomeMessage(lang: ChatLang = 'pl'): string {
  return MOCK_RESPONSES[lang].default;
}
