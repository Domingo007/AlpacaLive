export const GITHUB_REPO = 'Domingo007/AlpacaLive';
export const APP_VERSION = '1.0.0';

export type FeedbackContext = 'chat' | 'form';
export type FormType = 'chemo' | 'hormonal' | 'immunotherapy';

export interface IssueMetadata {
  language: 'pl' | 'en';
  context: FeedbackContext;
  formType?: FormType;
  aiProvider?: string;
}

export function buildUnknownDrugIssueUrl(drugs: string[], metadata: IssueMetadata): string {
  const titlePrefix = metadata.language === 'pl' ? 'Brakujący lek' : 'Missing drug';
  const title = `[${titlePrefix}] ${drugs.join(', ')}`;

  const drugList = drugs.map(d => `- ${d}`).join('\n');
  const contextLine = metadata.context === 'chat'
    ? 'User mentioned this drug in chat but it was not in the database.'
    : `User entered this drug in form (${metadata.formType ?? 'unknown'}) but it was not recognized.`;

  const bodyLines = [
    metadata.language === 'pl' ? '## Brakujące leki' : '## Missing drugs',
    '',
    drugList,
    '',
    `**Context:** ${contextLine}`,
    '',
    '---',
    '',
    `**App version:** ${APP_VERSION}`,
    metadata.aiProvider ? `**AI Provider:** ${metadata.aiProvider}` : null,
    `**Language:** ${metadata.language.toUpperCase()}`,
    `**Timestamp:** ${new Date().toISOString()}`,
    '',
    'Please add this medication to medical-knowledge/drugs/trade-names/index.json',
  ].filter((l): l is string => l !== null);

  const params = new URLSearchParams({
    template: 'medical_data.md',
    title,
    body: bodyLines.join('\n'),
    labels: 'medical-knowledge',
  });

  return `https://github.com/${GITHUB_REPO}/issues/new?${params.toString()}`;
}

export function filterNewUnknowns(detected: string[], alreadyReported: Set<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of detected) {
    const key = d.toLowerCase();
    if (alreadyReported.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}
