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
    title: 'Wszystko poniżej jest opcjonalne',
    body: 'AlpacaLive działa w pełni bez podłączonych urządzeń. Najprostsza ścieżka jeśli masz wearable: Oura (wklej token, gotowe). Withings i Strava wymagają jednorazowej rejestracji aplikacji u dostawcy. Brak urządzenia? Wpisuj dane ręcznie w dzienniku albo importuj CSV.',
  } : {
    title: 'Everything below is optional',
    body: 'AlpacaLive works fully without any device connected. Simplest path if you own a wearable: Oura (paste a token, done). Withings and Strava need a one-time app registration at the provider. No wearable? Enter data manually in the journal or import a CSV.',
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
