import { useEffect, useState } from 'react';
import { Icon } from '@/components/shared/Icon';
import { useI18n } from '@/lib/i18n';
import { openWearablesClient } from '@/lib/openwearables-client';
import { syncOpenWearables } from '@/lib/openwearables-adapter';
import { OpenWearablesConnectModal } from '@/components/settings/OpenWearablesConnectModal';
import type { OWConnection } from '@/types/openwearables';

export function OpenWearablesStatus() {
  const { lang } = useI18n();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [connections, setConnections] = useState<OWConnection[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const l = lang === 'pl' ? {
    title: 'Open Wearables',
    devicesConnected: (n: number) => n === 1 ? '1 urządzenie połączone' : `${n} urządzenia połączone`,
    emptyState: 'Połącz urządzenie, aby wzbogacić swój profil dnia. Open Wearables wspiera 7 marek.',
    sync: 'Synchronizuj',
    syncing: 'Synchronizacja…',
    manage: 'Zarządzaj',
    syncedDays: (n: number) => `Zsynchronizowano ${n} dni`,
    syncError: 'Błąd synchronizacji',
  } : lang === 'de' ? {
    title: 'Open Wearables',
    devicesConnected: (n: number) => n === 1 ? '1 Gerät verbunden' : `${n} Geräte verbunden`,
    emptyState: 'Verbinden Sie ein Wearable, um Ihr Tagesprofil zu bereichern. Open Wearables unterstützt 7 Marken.',
    sync: 'Synchronisieren',
    syncing: 'Synchronisierung…',
    manage: 'Verwalten',
    syncedDays: (n: number) => `${n} Tage synchronisiert`,
    syncError: 'Synchronisierung fehlgeschlagen',
  } : {
    title: 'Open Wearables',
    devicesConnected: (n: number) => n === 1 ? '1 device connected' : `${n} devices connected`,
    emptyState: 'Connect a wearable to enrich your daily profile. Open Wearables supports 7 brands.',
    sync: 'Sync',
    syncing: 'Syncing…',
    manage: 'Manage',
    syncedDays: (n: number) => `Synced ${n} days`,
    syncError: 'Sync failed',
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const isConfigured = await openWearablesClient.isConfigured();
      if (cancelled) return;
      if (!isConfigured) {
        setConfigured(false);
        return;
      }
      setConfigured(true);
      try {
        const list = await openWearablesClient.listConnections();
        if (!cancelled) setConnections(list);
      } catch {
        // silent — leave empty
      }
    })();
    return () => { cancelled = true; };
  }, [showModal]); // refresh when modal closes

  // Don't show the tile at all when client isn't configured — this is a
  // graceful degradation per CLAUDE.md (silent-fail rather than broken tile).
  if (configured === null) return null;
  if (configured === false) return null;

  const activeCount = connections.filter(c => c.status === 'active').length;

  async function handleSync() {
    setSyncing(true);
    setSyncMessage('');
    try {
      const result = await syncOpenWearables(7);
      if (result.success) {
        setSyncMessage(l.syncedDays(result.syncedDays));
      } else {
        setSyncMessage(l.syncError);
      }
    } catch {
      setSyncMessage(l.syncError);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(''), 3000);
    }
  }

  return (
    <>
      <div className="bg-bg-card rounded-2xl border border-lavender-100 p-4 shadow-[0_4px_12px_rgba(45,31,84,0.08)]">
        <div className="flex items-start gap-3">
          <Icon name="hub" size={28} className="text-lavender-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-semibold text-text-primary">{l.title}</h3>
              {activeCount > 0 && (
                <span className="text-[11px] font-semibold text-accent-green">
                  {l.devicesConnected(activeCount)}
                </span>
              )}
            </div>
            <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
              {activeCount === 0 ? l.emptyState : ''}
            </p>
            {syncMessage && (
              <div className="text-[10px] text-text-tertiary mt-1 italic">{syncMessage}</div>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setShowModal(true)}
                className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-accent-dark text-white hover:bg-accent-dark/90 font-medium"
              >
                {l.manage}
              </button>
              {activeCount > 0 && (
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="text-xs px-3 py-1.5 rounded-lg border border-border bg-bg-primary text-text-secondary disabled:opacity-50"
                >
                  {syncing ? l.syncing : l.sync}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <OpenWearablesConnectModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
