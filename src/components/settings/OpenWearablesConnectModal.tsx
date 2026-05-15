import { useEffect, useState } from 'react';
import { Icon } from '@/components/shared/Icon';
import { useI18n } from '@/lib/i18n';
import { openWearablesClient } from '@/lib/openwearables-client';
import {
  OPEN_WEARABLES_PROVIDERS,
  type OpenWearablesProvider,
  type OWConnection,
} from '@/types/openwearables';

interface ProviderMeta {
  id: OpenWearablesProvider;
  label: string;
  icon: string;
}

const PROVIDERS: ProviderMeta[] = [
  { id: 'oura', label: 'Oura Ring', icon: 'circle' },
  { id: 'whoop', label: 'Whoop', icon: 'fitness_center' },
  { id: 'ultrahuman', label: 'Ultrahuman', icon: 'all_inclusive' },
  { id: 'garmin', label: 'Garmin', icon: 'watch' },
  { id: 'polar', label: 'Polar', icon: 'monitor_heart' },
  { id: 'suunto', label: 'Suunto', icon: 'explore' },
  { id: 'strava', label: 'Strava', icon: 'directions_run' },
];

// Sanity: keep PROVIDERS aligned with the canonical enum (catches typos at build time).
if (PROVIDERS.length !== OPEN_WEARABLES_PROVIDERS.length) {
  throw new Error('PROVIDERS array out of sync with OPEN_WEARABLES_PROVIDERS');
}

interface ProviderState {
  status: 'idle' | 'connecting' | 'error';
  errorMessage?: string;
}

export function OpenWearablesConnectModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { lang } = useI18n();
  const [connections, setConnections] = useState<OWConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [perProvider, setPerProvider] = useState<Record<string, ProviderState>>({});
  const [unconfigured, setUnconfigured] = useState(false);

  const l = lang === 'pl' ? {
    title: 'Połącz urządzenia',
    subtitle: 'Open Wearables obsługuje 7 urządzeń OAuth. Po kliknięciu „Połącz" otworzy się strona dostawcy w nowej karcie.',
    connect: 'Połącz',
    connecting: 'Łączenie…',
    connected: 'Połączono',
    disconnect: 'Rozłącz',
    notConfigured: 'Open Wearables nie jest skonfigurowane. Wpisz URL i klucz API w sekcji Open Wearables (self-hosted) powyżej.',
    nativeNote: 'Apple Health, Samsung Health i Google Health Connect wymagają aplikacji mobilnej i nie są dostępne z poziomu PWA.',
    close: 'Zamknij',
    error: 'Błąd',
    errorPrefix: 'Nie udało się połączyć',
  } : lang === 'de' ? {
    title: 'Geräte verbinden',
    subtitle: 'Open Wearables unterstützt 7 OAuth-Geräte. Beim Klicken auf „Verbinden" wird die Anmeldeseite des Anbieters in einem neuen Tab geöffnet.',
    connect: 'Verbinden',
    connecting: 'Verbindung…',
    connected: 'Verbunden',
    disconnect: 'Trennen',
    notConfigured: 'Open Wearables ist nicht konfiguriert. Geben Sie URL + API-Schlüssel im Abschnitt "Open Wearables (selbst gehostet)" oben ein.',
    nativeNote: 'Apple Health, Samsung Health und Google Health Connect erfordern eine mobile App und sind von einer PWA aus nicht erreichbar.',
    close: 'Schließen',
    error: 'Fehler',
    errorPrefix: 'Verbindung fehlgeschlagen',
  } : {
    title: 'Connect devices',
    subtitle: 'Open Wearables supports 7 OAuth devices. Clicking "Connect" opens the provider login in a new tab.',
    connect: 'Connect',
    connecting: 'Connecting…',
    connected: 'Connected',
    disconnect: 'Disconnect',
    notConfigured: 'Open Wearables is not configured. Enter URL + API key in the "Open Wearables (self-hosted)" section above.',
    nativeNote: 'Apple Health, Samsung Health and Google Health Connect require a mobile app and are not reachable from a PWA.',
    close: 'Close',
    error: 'Error',
    errorPrefix: 'Could not connect',
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const configured = await openWearablesClient.isConfigured();
      if (cancelled) return;
      if (!configured) {
        setUnconfigured(true);
        setLoading(false);
        return;
      }
      setUnconfigured(false);
      try {
        const list = await openWearablesClient.listConnections();
        if (!cancelled) setConnections(list);
      } catch {
        // silent — leave list empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function handleConnect(provider: OpenWearablesProvider) {
    setPerProvider(p => ({ ...p, [provider]: { status: 'connecting' } }));
    try {
      const { authorizationUrl } = await openWearablesClient.startConnect(provider);
      window.open(authorizationUrl, '_blank', 'noopener,noreferrer');
      setPerProvider(p => ({ ...p, [provider]: { status: 'idle' } }));
    } catch (err) {
      setPerProvider(p => ({
        ...p,
        [provider]: {
          status: 'error',
          errorMessage: err instanceof Error ? err.message : 'unknown',
        },
      }));
    }
  }

  if (!open) return null;

  const connectionByProvider = new Map(connections.map(c => [c.provider, c]));

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={l.title}
    >
      <div
        className="bg-bg-card rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 flex items-center gap-3 border-b border-lavender-100">
          <Icon name="hub" size={28} className="text-lavender-600 shrink-0" />
          <div className="flex-1">
            <h2 className="text-base font-semibold text-text-primary">{l.title}</h2>
            <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">{l.subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary p-1"
            aria-label={l.close}
          >
            <Icon name="close" size={22} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {unconfigured ? (
            <div className="bg-yellow-50 rounded-lg p-3 text-xs text-yellow-800 border border-yellow-200">
              {l.notConfigured}
            </div>
          ) : loading ? (
            <div className="text-xs text-text-tertiary py-4 text-center">…</div>
          ) : (
            <ul className="space-y-2">
              {PROVIDERS.map(p => {
                const connection = connectionByProvider.get(p.id);
                const state = perProvider[p.id]?.status ?? 'idle';
                const isConnected = connection?.status === 'active';
                return (
                  <li key={p.id} className="flex items-center gap-3 bg-bg-primary rounded-xl border border-lavender-100 p-3">
                    <Icon name={p.icon} size={22} className={isConnected ? 'text-accent-green' : 'text-lavender-500'} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text-primary">{p.label}</div>
                      {isConnected && connection?.connectedAt && (
                        <div className="text-[10px] text-text-tertiary">
                          {l.connected} · {connection.connectedAt.split('T')[0]}
                        </div>
                      )}
                      {perProvider[p.id]?.status === 'error' && (
                        <div className="text-[10px] text-red-600 truncate" title={perProvider[p.id]?.errorMessage}>
                          {l.errorPrefix}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleConnect(p.id)}
                      disabled={state === 'connecting'}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                        isConnected
                          ? 'bg-bg-card border border-border text-text-secondary'
                          : 'bg-accent-dark text-white hover:bg-accent-dark/90'
                      } disabled:opacity-50`}
                    >
                      {state === 'connecting' ? l.connecting : isConnected ? l.connected : l.connect}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="bg-lavender-50 rounded-lg px-3 py-2 text-[11px] text-lavender-800 border border-lavender-200 flex items-start gap-2">
            <Icon name="info" size={14} className="shrink-0 mt-0.5" />
            <span>{l.nativeNote}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
