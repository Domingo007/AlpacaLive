/*
 * AlpacaLive — Your Companion Through Cancer Treatment
 * Copyright (C) 2025 AlpacaLive Contributors
 * Licensed under AGPL-3.0 — see LICENSE file
 */
export type AIProvider = 'anthropic' | 'openai' | 'gemini';

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | AIMessageContent[];
}

export type AIMessageContent =
  | { type: 'text'; text: string }
  | { type: 'image'; mimeType: string; data: string };

export interface AIResponse {
  text: string;
  provider: AIProvider;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

interface ProviderSpec {
  endpoint: string;
  defaultModel: string;
  visionModel: string;
  label: string;
  headers: (apiKey: string) => Record<string, string>;
  buildBody: (systemPrompt: string, messages: AIMessage[], model: string) => unknown;
  parseResponse: (data: unknown) => { text: string; usage?: { inputTokens: number; outputTokens: number } };
}

const PROVIDERS: Record<AIProvider, ProviderSpec> = {
  anthropic: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-sonnet-4-20250514',
    visionModel: 'claude-sonnet-4-20250514',
    label: 'Anthropic Claude',
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }),
    buildBody: (systemPrompt, messages, model) => ({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : m.content.map(c => {
          if (c.type === 'text') return { type: 'text', text: c.text };
          return { type: 'image', source: { type: 'base64', media_type: c.mimeType, data: c.data } };
        }),
      })),
    }),
    parseResponse: (data: any) => ({
      text: data.content?.map((c: any) => c.text || '').join('') || '',
      usage: data.usage ? { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens } : undefined,
    }),
  },

  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o',
    visionModel: 'gpt-4o',
    label: 'OpenAI GPT',
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }),
    buildBody: (systemPrompt, messages, model) => ({
      model,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.filter(m => m.role !== 'system').map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : m.content.map(c => {
            if (c.type === 'text') return { type: 'text', text: c.text };
            return { type: 'image_url', image_url: { url: `data:${c.mimeType};base64,${c.data}` } };
          }),
        })),
      ],
    }),
    parseResponse: (data: any) => ({
      text: data.choices?.[0]?.message?.content || '',
      usage: data.usage ? { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens } : undefined,
    }),
  },

  gemini: {
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    defaultModel: 'gemini-2.5-flash',
    visionModel: 'gemini-2.5-flash',
    label: 'Google Gemini',
    headers: () => ({ 'Content-Type': 'application/json' }),
    buildBody: (systemPrompt, messages, _model) => ({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: typeof m.content === 'string'
          ? [{ text: m.content }]
          : m.content.map(c => {
              if (c.type === 'text') return { text: c.text };
              return { inline_data: { mime_type: c.mimeType, data: c.data } };
            }),
      })),
    }),
    parseResponse: (data: any) => ({
      text: data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '',
      usage: data.usageMetadata ? { inputTokens: data.usageMetadata.promptTokenCount, outputTokens: data.usageMetadata.candidatesTokenCount } : undefined,
    }),
  },
};

export function getProviderLabel(provider: AIProvider): string {
  return PROVIDERS[provider].label;
}

export function getProviderDefaultModel(provider: AIProvider): string {
  return PROVIDERS[provider].defaultModel;
}

export async function sendToAI(
  config: AIProviderConfig,
  systemPrompt: string,
  messages: AIMessage[],
  hasImages = false,
): Promise<AIResponse> {
  const spec = PROVIDERS[config.provider];
  const model = config.model || (hasImages ? spec.visionModel : spec.defaultModel);

  let endpoint = spec.endpoint;
  let headers = spec.headers(config.apiKey);

  if (config.provider === 'gemini') {
    // Gemini: put API key in header instead of URL to avoid logging in browser history
    endpoint = endpoint.replace('{model}', model);
    headers = { ...headers, 'x-goog-api-key': config.apiKey };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(spec.buildBody(systemPrompt, messages, model)),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Błąd API ${spec.label}: ${response.status} — ${error.slice(0, 200)}`);
  }

  const data = await response.json();
  const parsed = spec.parseResponse(data);

  return { ...parsed, provider: config.provider, model };
}

export async function testConnection(config: AIProviderConfig, lang: 'pl' | 'en' | 'de' = 'pl'): Promise<{ success: boolean; message: string }> {
  const testPrompt = lang === 'en'
    ? 'Answer in one word: OK'
    : lang === 'de'
    ? 'Antworten Sie mit einem Wort: OK'
    : 'Odpowiedz jednym słowem: OK';
  const connectedMsg = (model: string) => lang === 'en'
    ? `Connected to ${PROVIDERS[config.provider].label}. Model: ${model}`
    : lang === 'de'
    ? `Verbunden mit ${PROVIDERS[config.provider].label}. Modell: ${model}`
    : `Połączono z ${PROVIDERS[config.provider].label}. Model: ${model}`;
  const unknownErr = lang === 'en' ? 'Unknown error' : lang === 'de' ? 'Unbekannter Fehler' : 'Nieznany błąd';
  try {
    const result = await sendToAI(config, testPrompt, [{ role: 'user', content: 'Test' }]);
    return { success: true, message: connectedMsg(result.model) };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : unknownErr;
    return { success: false, message: msg };
  }
}

type ProviderInfoLang = 'pl' | 'en' | 'de';

export function getProviderInfo(lang: ProviderInfoLang = 'pl'): Record<AIProvider, { label: string; description: string; cost: string; link: string }> {
  if (lang === 'en') return {
    anthropic: {
      label: 'Anthropic Claude',
      description: 'Best medical accuracy. Cautious with advice.',
      cost: '~$2-5/month',
      link: 'console.anthropic.com',
    },
    openai: {
      label: 'OpenAI (GPT-4o / GPT-5)',
      description: 'Strong medical knowledge. Widely available.',
      cost: '~$2-6/month',
      link: 'platform.openai.com',
    },
    gemini: {
      label: 'Google Gemini',
      description: 'Free tier available. Longest context.',
      cost: 'Free / ~$1/month',
      link: 'aistudio.google.com',
    },
  };
  if (lang === 'de') return {
    anthropic: {
      label: 'Anthropic Claude',
      description: 'Beste medizinische Genauigkeit. Vorsichtig bei Ratschlägen.',
      cost: '~2-5 €/Monat',
      link: 'console.anthropic.com',
    },
    openai: {
      label: 'OpenAI (GPT-4o / GPT-5)',
      description: 'Solides medizinisches Wissen. Weit verbreitet.',
      cost: '~2-6 €/Monat',
      link: 'platform.openai.com',
    },
    gemini: {
      label: 'Google Gemini',
      description: 'Kostenlose Stufe verfügbar. Längster Kontext.',
      cost: 'Kostenlos / ~1 €/Monat',
      link: 'aistudio.google.com',
    },
  };
  return {
    anthropic: {
      label: 'Anthropic Claude',
      description: 'Najlepsza dokładność medyczna po polsku. Ostrożny w poradach.',
      cost: '~5-15 zł/mies.',
      link: 'console.anthropic.com',
    },
    openai: {
      label: 'OpenAI (GPT-4o / GPT-5)',
      description: 'Dobra wiedza medyczna. Szeroko dostępny.',
      cost: '~5-20 zł/mies.',
      link: 'platform.openai.com',
    },
    gemini: {
      label: 'Google Gemini',
      description: 'Darmowy limit dostępny. Najdłuższy kontekst.',
      cost: 'Darmowy / ~5 zł/mies.',
      link: 'aistudio.google.com',
    },
  };
}

// Backwards-compat: default PL info used by non-React callers
export const PROVIDER_INFO = getProviderInfo('pl');
