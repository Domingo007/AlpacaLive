import React, { useEffect, useState } from 'react';
import { getAuditLog, getAuditStats } from '@/lib/audit-logger';
import { db } from '@/lib/db';
import { Card } from '@/components/shared/Card';
import { Icon } from '@/components/shared/Icon';
import { useI18n } from '@/lib/i18n';
import type { AIAuditLogEntry } from '@/types/audit-log';

const PII_FIELD_LABELS: Record<string, string> = {
  displayName: 'imię',
  treatmentFacility: 'szpital',
  exactAge: 'dokładny wiek',
  psychiatricMedDetails: 'leki psych.',
  treatmentCountry: 'kraj leczenia',
};

export function AuditLogPanel() {
  const { lang } = useI18n();
  const [entries, setEntries] = useState<AIAuditLogEntry[]>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getAuditStats>> | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getAuditLog(showAll ? 200 : 10), getAuditStats()])
      .then(([log, s]) => {
        setEntries(log);
        setStats(s);
      })
      .finally(() => setLoading(false));
  }, [showAll]);

  const handleClear = async () => {
    const confirmMsg = lang === 'pl'
      ? 'Wyczyścić historię komunikacji z AI? Tej operacji nie można cofnąć.'
      : 'Clear AI communication history? This action cannot be undone.';

    if (!window.confirm(confirmMsg)) return;

    await db.aiAuditLog.clear();
    setEntries([]);
    setStats(prev => prev ? { ...prev, totalCalls: 0, last30Days: 0, byProvider: {} } : null);
  };

  const title = lang === 'pl' ? '🔒 Historia komunikacji z AI' : '🔒 AI Communication History';
  const noDataMsg = lang === 'pl' ? 'Brak zapisanych interakcji' : 'No saved interactions';

  return (
    <Card title={title}>
      <div className="space-y-3 text-xs">
        {/* Stats summary */}
        {stats && (
          <div className="bg-white/5 rounded-lg px-3 py-2 space-y-1">
            <div className="flex justify-between">
              <span className="text-text-secondary">{lang === 'pl' ? 'Łącznie:' : 'Total:'}</span>
              <span className="font-medium">{stats.totalCalls} {lang === 'pl' ? 'zapytań' : 'queries'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">{lang === 'pl' ? 'Ostatnie 30 dni:' : 'Last 30 days:'}</span>
              <span className="font-medium">{stats.last30Days}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">{lang === 'pl' ? 'Średnio tokenów:' : 'Avg tokens:'}</span>
              <span className="font-medium">~{stats.avgInputTokens}</span>
            </div>

            {/* Provider breakdown */}
            {Object.keys(stats.byProvider).length > 0 && (
              <div className="flex gap-2 flex-wrap pt-1 border-t border-white/10">
                {Object.entries(stats.byProvider).map(([provider, count]) => (
                  <div key={provider} className="bg-white/10 px-2 py-1 rounded text-[10px]">
                    {provider}: {count}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Entries list */}
        {loading ? (
          <div className="text-text-tertiary text-center py-4">{lang === 'pl' ? 'Ładowanie...' : 'Loading...'}</div>
        ) : entries.length === 0 ? (
          <div className="text-text-tertiary text-center py-4">{noDataMsg}</div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {entries.map(entry => (
              <div key={entry.id} className="bg-white/5 rounded-lg px-2.5 py-2 space-y-1 text-[11px]">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-text-secondary">
                      {new Date(entry.timestamp).toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-US', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                    <span className="font-medium capitalize">{entry.provider}</span>
                  </div>
                  <span className={entry.success ? 'text-accent-green' : 'text-alert-critical'}>
                    {entry.success ? '✓' : `✗ ${entry.errorCode || 'error'}`}
                  </span>
                </div>

                {/* Details */}
                <div className="text-[10px] text-text-secondary space-y-0.5">
                  <div>{entry.model}</div>
                  <div>
                    {lang === 'pl' ? 'Tokeny:' : 'Tokens:'} ~{entry.inputTokensEstimate} (in) / ~{entry.outputTokensEstimate} (out)
                  </div>

                  {/* PII removed */}
                  {entry.piiFieldsRemoved.length > 0 && (
                    <div>
                      {lang === 'pl' ? 'Usunięto:' : 'Removed:'}{' '}
                      {entry.piiFieldsRemoved
                        .map(f => PII_FIELD_LABELS[f] ?? f)
                        .join(', ')}
                    </div>
                  )}

                  {/* Other flags */}
                  <div className="flex gap-2 flex-wrap text-[9px]">
                    {entry.psychiatricAbstracted && (
                      <span className="bg-white/10 px-1 py-0.5 rounded">
                        {lang === 'pl' ? 'leki psych.' : 'psych meds'}
                      </span>
                    )}
                    {entry.drugNamesResolved > 0 && (
                      <span className="bg-white/10 px-1 py-0.5 rounded">
                        {entry.drugNamesResolved} {lang === 'pl' ? 'leków' : 'drugs'}
                      </span>
                    )}
                    <span className="bg-white/10 px-1 py-0.5 rounded">
                      {entry.ageDecadeUsed} / {entry.guidelineRegion}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {entries.length > 10 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="flex-1 text-[11px] px-2 py-1.5 rounded-lg border border-border hover:bg-white/5 transition-colors"
            >
              {lang === 'pl'
                ? (showAll ? 'Pokaż mniej' : 'Pokaż więcej')
                : (showAll ? 'Show less' : 'Show more')}
            </button>
          )}
          <button
            onClick={handleClear}
            disabled={entries.length === 0}
            className={`flex-1 text-[11px] px-2 py-1.5 rounded-lg transition-colors ${
              entries.length === 0
                ? 'bg-border text-text-tertiary cursor-not-allowed'
                : 'border border-alert-critical text-alert-critical hover:bg-alert-critical/10'
            }`}
          >
            {lang === 'pl' ? 'Wyczyść' : 'Clear'}
          </button>
        </div>
      </div>
    </Card>
  );
}
