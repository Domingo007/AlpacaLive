export interface AIAuditLogEntry {
  id?: number;
  timestamp: Date;
  provider: 'anthropic' | 'openai' | 'gemini';
  model: string;
  inputTokensEstimate: number;
  outputTokensEstimate: number;
  piiFieldsRemoved: string[];
  psychiatricAbstracted: boolean;
  drugNamesResolved: number;
  guidelineRegion: 'ESMO' | 'NCCN' | 'both';
  ageDecadeUsed: string;
  success: boolean;
  errorCode?: string;
}
