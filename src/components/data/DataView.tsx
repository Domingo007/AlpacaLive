import { useState, useEffect } from 'react';
import { useDashboardData } from '@/hooks/useDatabase';
import { Card } from '@/components/shared/Card';
import { StatCard } from '@/components/shared/StatCard';
import { Icon } from '@/components/shared/Icon';
import { DailyProfileView } from './DailyProfileView';
import { HydrationTile } from '@/components/dashboard/HydrationTile';
import { OpenWearablesStatus } from '@/components/dashboard/OpenWearablesStatus';
import { EnergyChart } from './EnergyChart';
import { BloodChart } from './BloodChart';
import { generateReportPDF } from '@/lib/report-generator';
import { DisclaimerBanner } from '@/components/shared/DisclaimerBanner';
import { buildCalendarEvents, getUpcomingEvents } from '@/lib/calendar-events';
import { useI18n } from '@/lib/i18n';
import type { CalendarEvent } from '@/types';

export function DataView() {
  const { daily, blood, wearable, counts, loading } = useDashboardData();
  const [generating, setGenerating] = useState(false);
  const [upcoming, setUpcoming] = useState<CalendarEvent[]>([]);
  const { t } = useI18n();

  useEffect(() => {
    buildCalendarEvents().then(ev => setUpcoming(getUpcomingEvents(ev, 7)));
  }, [loading]);

  async function handleGenerateReport() {
    setGenerating(true);
    try {
      await generateReportPDF(30);
    } catch (err) {
      alert(t.dataView.reportError(err instanceof Error ? err.message : t.common.unknown));
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary">
        {t.common.loading}
      </div>
    );
  }

  const hasData = Object.values(counts).some(c => c > 0);

  return (
    <div className="h-full overflow-y-auto px-3 py-4 space-y-4">
      {/* Daily Profile — first thing patient sees */}
      <DailyProfileView />

      {/* Hydration Trend — pattern-based, graceful degradation */}
      <HydrationTile />

      {/* Open Wearables connection status — only renders when configured */}
      <OpenWearablesStatus />

      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-accent-dark">{t.dataView.title}</h2>
        <button
          onClick={handleGenerateReport}
          disabled={generating || !hasData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-dark text-accent-warm text-xs font-medium disabled:opacity-40"
        >
          {generating ? t.dataView.generating : t.dataView.pdfReport}
        </button>
      </div>

      <DisclaimerBanner variant="data" />

      {upcoming.length > 0 && (
        <Card title={t.dataView.upcoming7days}>
          <div className="space-y-1.5">
            {upcoming.slice(0, 5).map(ev => {
              const daysFromNow = Math.round((new Date(ev.date).getTime() - Date.now()) / (1000*60*60*24));
              const label = daysFromNow === 0 ? t.common.today : daysFromNow === 1 ? t.common.tomorrow : t.common.inDays(daysFromNow);
              return (
                <div key={ev.id} className="flex items-center gap-2 text-xs">
                  <span className="text-text-secondary w-14 shrink-0">{label}</span>
                  {ev.icon && <Icon name={ev.icon} size={14} />}
                  <span className="truncate">{ev.title}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2">
        <StatCard icon="edit_note" label={t.dataView.journalEntries} value={counts.daily || 0} />
        <StatCard icon="water_drop" label={t.dataView.bloodTests} value={counts.blood || 0} />
        <StatCard icon="watch" label={t.dataView.wearableData} value={counts.wearable || 0} />
        <StatCard icon="restaurant" label={t.dataView.meals} value={counts.meals || 0} />
        <StatCard icon="vaccines" label={t.dataView.chemoSessions} value={counts.chemo || 0} />
        <StatCard icon="imagesmode" label={t.dataView.imaging} value={counts.imaging || 0} />
      </div>

      {!hasData ? (
        <Card>
          <div className="text-center py-8 text-text-secondary text-sm">
            <div className="text-lavender-400 mb-3"><span className="material-symbols-rounded" style={{fontSize:48}}>bar_chart</span></div>
            <p>{t.dataView.noData}</p>
            <p className="mt-1">{t.dataView.noDataHint}</p>
          </div>
        </Card>
      ) : (
        <>
          {daily.length > 0 && (
            <Card title={t.dataView.energyMoodPain}>
              <EnergyChart data={daily} />
            </Card>
          )}

          {blood.length > 0 && (
            <Card title={t.dataView.bloodMarkers}>
              <BloodChart data={blood} />
            </Card>
          )}

          {wearable.length > 0 && (
            <Card title={t.dataView.wearableData}>
              <div className="space-y-2">
                {wearable.slice(0, 5).map(w => (
                  <div key={w.id} className="flex justify-between text-xs border-b border-border pb-1">
                    <span>{w.date}</span>
                    <span>RHR: {w.rhr}</span>
                    <span>HRV: {w.hrv}</span>
                    <span>SpO2: {w.spo2}%</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
