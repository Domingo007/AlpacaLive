import { Icon } from '@/components/shared/Icon';
import { useI18n } from '@/lib/i18n';

/**
 * Banner placed above the wearable integration cards (Open Wearables,
 * Withings, Connected Devices) reminding users that all of these are
 * optional. AlpacaLive works fully without any device connected:
 * notebook mode, manual journaling, CSV import, and pattern engines all
 * function on data the patient enters by hand.
 */
export function IntegrationsOptionalBanner() {
  const { lang } = useI18n();
  const l = lang === 'pl' ? {
    title: 'Integracje są opcjonalne',
    body: 'AlpacaLive działa w pełni bez podłączonych urządzeń. Możesz wpisywać dane ręcznie w dzienniku, importować CSV (Garmin, Withings, Apple Health) lub zostawić te sekcje puste — wszystkie funkcje analizy wzorców i podsumowania działają na podstawie tego, co sam(a) wprowadzisz.',
  } : {
    title: 'These integrations are optional',
    body: 'AlpacaLive works fully without any device connected. You can enter data manually via the journal, import CSV files (Garmin, Withings, Apple Health), or leave these sections empty — pattern analysis and summaries work entirely on what you log by hand.',
  };
  return (
    <div className="bg-lavender-50 border border-lavender-200 rounded-2xl p-4 flex gap-3 items-start">
      <Icon name="lightbulb" size={22} className="text-lavender-600 shrink-0 mt-0.5" />
      <div>
        <div className="text-[13px] font-semibold text-lavender-800 mb-0.5">{l.title}</div>
        <p className="text-[11px] text-text-secondary leading-relaxed">{l.body}</p>
      </div>
    </div>
  );
}
