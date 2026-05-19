import { useEffect, useState } from 'react';
import { Card } from '@/components/shared/Card';
import { Icon } from '@/components/shared/Icon';
import { useI18n } from '@/lib/i18n';
import { getSettings, saveSettings } from '@/lib/db';
import { ouraClient } from '@/lib/oura-client';
import { syncOura } from '@/lib/oura-adapter';
import { SetupGuide } from './SetupGuide';

type Status = 'idle' | 'testing' | 'connected' | 'error';

export function OuraSettings() {
  const { lang } = useI18n();
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const l = lang === 'pl' ? {
    title: 'Oura Ring',
    desc: 'Najprostsza integracja: zaloguj się na cloud.ouraring.com, wygeneruj Personal Access Token i wklej tu. Bez Dockera, bez OAuth. Działa od razu.',
    token: 'Personal Access Token',
    show: 'Pokaż',
    hide: 'Ukryj',
    save: 'Zapisz i połącz',
    sync: 'Synchronizuj 7 dni',
    syncing: 'Synchronizacja…',
    statusIdle: 'Niezapisane',
    statusTesting: 'Sprawdzanie…',
    statusConnected: 'Połączono',
    statusError: 'Błąd',
    syncedDays: (n: number) => `Zsynchronizowano ${n} dni`,
    syncError: 'Błąd synchronizacji',
    guideTitle: 'Krok po kroku — jak uzyskać token?',
  } : lang === 'de' ? {
    title: 'Oura Ring',
    desc: 'Einfachste Integration: Melden Sie sich auf cloud.ouraring.com an, generieren Sie ein Personal Access Token und fügen Sie es hier ein. Kein Docker, kein OAuth. Funktioniert sofort.',
    token: 'Personal Access Token',
    show: 'Anzeigen',
    hide: 'Verbergen',
    save: 'Speichern und verbinden',
    sync: '7 Tage synchronisieren',
    syncing: 'Synchronisierung…',
    statusIdle: 'Nicht gespeichert',
    statusTesting: 'Wird geprüft…',
    statusConnected: 'Verbunden',
    statusError: 'Fehler',
    syncedDays: (n: number) => `${n} Tage synchronisiert`,
    syncError: 'Synchronisierung fehlgeschlagen',
    guideTitle: 'Schritt für Schritt — wie bekomme ich einen Token?',
  } : {
    title: 'Oura Ring',
    desc: 'Simplest integration: sign in to cloud.ouraring.com, generate a Personal Access Token, paste it here. No Docker, no OAuth. Works immediately.',
    token: 'Personal Access Token',
    show: 'Show',
    hide: 'Hide',
    save: 'Save and connect',
    sync: 'Sync 7 days',
    syncing: 'Syncing…',
    statusIdle: 'Unsaved',
    statusTesting: 'Checking…',
    statusConnected: 'Connected',
    statusError: 'Error',
    syncedDays: (n: number) => `Synced ${n} days`,
    syncError: 'Sync failed',
    guideTitle: 'Step-by-step — how do I get a token?',
  };

  useEffect(() => {
    (async () => {
      const settings = await getSettings();
      if (settings?.ouraPersonalAccessToken) {
        setToken(settings.ouraPersonalAccessToken);
        // Verify token still valid
        setStatus('testing');
        const ok = await ouraClient.ping();
        setStatus(ok ? 'connected' : 'error');
        if (!ok) setErrorMessage('token invalid or expired');
      }
    })();
  }, []);

  async function handleSave() {
    setBusy(true);
    setStatus('testing');
    setErrorMessage('');
    await saveSettings({ ouraPersonalAccessToken: token.trim() || undefined });
    if (!token.trim()) {
      setStatus('idle');
      setBusy(false);
      return;
    }
    const ok = await ouraClient.ping();
    setStatus(ok ? 'connected' : 'error');
    if (!ok) setErrorMessage('token invalid or expired');
    setBusy(false);
  }

  async function handleSync() {
    setBusy(true);
    setSyncMessage('');
    try {
      const result = await syncOura(7);
      setSyncMessage(result.success ? l.syncedDays(result.syncedDays) : l.syncError);
    } catch {
      setSyncMessage(l.syncError);
    } finally {
      setBusy(false);
      setTimeout(() => setSyncMessage(''), 3000);
    }
  }

  const guideSteps = lang === 'pl' ? [
    <>Otwórz <a href="https://cloud.ouraring.com/personal-access-tokens" target="_blank" rel="noopener" className="text-lavender-700 underline">cloud.ouraring.com/personal-access-tokens</a> i zaloguj się tym samym kontem co w aplikacji Oura.<br /><span className="text-text-tertiary">[screenshot: strona Personal Access Tokens]</span></>,
    <>Kliknij <strong>Create New Personal Access Token</strong>. Wpisz dowolną nazwę (np. AlpacaLive). Kliknij <strong>Create</strong>.</>,
    <>Oura pokaże token jeden raz — <em>natychmiast skopiuj</em>. Ma format długiego ciągu liter i cyfr.<br /><span className="text-text-tertiary">[screenshot: ekran z tokenem]</span></>,
    <>Wklej token w pole powyżej i kliknij <strong>Zapisz i połącz</strong>. Status zmieni się na „Połączono".</>,
    <>Kliknij <strong>Synchronizuj 7 dni</strong> — ostatni tydzień snu, gotowości, aktywności i SpO₂ wyląduje w zakładce Dane.</>,
  ] : lang === 'de' ? [
    <>Öffnen Sie <a href="https://cloud.ouraring.com/personal-access-tokens" target="_blank" rel="noopener" className="text-lavender-700 underline">cloud.ouraring.com/personal-access-tokens</a> und melden Sie sich mit demselben Konto an, das Sie in der Oura-App verwenden.<br /><span className="text-text-tertiary">[Screenshot: Personal Access Tokens-Seite]</span></>,
    <>Klicken Sie auf <strong>Create New Personal Access Token</strong>. Geben Sie einen beliebigen Namen ein (z. B. AlpacaLive). Klicken Sie auf <strong>Create</strong>.</>,
    <>Oura zeigt den Token <em>einmal</em> an — sofort kopieren. Es ist eine lange alphanumerische Zeichenfolge.<br /><span className="text-text-tertiary">[Screenshot: Token-Anzeigebildschirm]</span></>,
    <>Fügen Sie den Token in das obige Feld ein und klicken Sie auf <strong>Speichern und verbinden</strong>. Der Status wechselt zu „Verbunden".</>,
    <>Klicken Sie auf <strong>7 Tage synchronisieren</strong> — die letzte Woche mit Schlaf, Bereitschaft, Aktivität und SpO₂ landet im Daten-Tab.</>,
  ] : [
    <>Open <a href="https://cloud.ouraring.com/personal-access-tokens" target="_blank" rel="noopener" className="text-lavender-700 underline">cloud.ouraring.com/personal-access-tokens</a> and sign in with the same account you use in the Oura app.<br /><span className="text-text-tertiary">[screenshot: Personal Access Tokens page]</span></>,
    <>Click <strong>Create New Personal Access Token</strong>. Give it any name (e.g. AlpacaLive). Click <strong>Create</strong>.</>,
    <>Oura shows the token <em>once</em> — copy it immediately. It's a long alphanumeric string.<br /><span className="text-text-tertiary">[screenshot: token display screen]</span></>,
    <>Paste the token in the field above and click <strong>Save and connect</strong>. Status flips to "Connected".</>,
    <>Click <strong>Sync 7 days</strong> — the last week of sleep, readiness, activity and SpO₂ lands in the Data tab.</>,
  ];

  const statusColors: Record<Status, string> = {
    idle: 'text-text-tertiary',
    testing: 'text-lavender-600',
    connected: 'text-accent-green',
    error: 'text-red-600',
  };
  const statusLabels: Record<Status, string> = {
    idle: l.statusIdle,
    testing: l.statusTesting,
    connected: l.statusConnected,
    error: l.statusError,
  };
  const icon: Record<Status, string> = {
    idle: 'radio_button_unchecked',
    testing: 'progress_activity',
    connected: 'check_circle',
    error: 'error',
  };

  return (
    <Card title={l.title}>
      <div className="space-y-3">
        <p className="text-[11px] text-text-secondary leading-relaxed">{l.desc}</p>

        <SetupGuide title={l.guideTitle} steps={guideSteps} />

        <div>
          <label className="text-[11px] text-text-secondary block mb-1">{l.token}</label>
          <div className="flex gap-1">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="ABCD…1234"
              className="flex-1 rounded-lg border border-border px-2.5 py-1.5 text-xs bg-bg-primary font-mono"
            />
            <button
              type="button"
              onClick={() => setShowToken(s => !s)}
              className="px-2 border border-border rounded-lg text-[11px] text-text-secondary hover:bg-bg-primary"
            >
              {showToken ? l.hide : l.show}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={busy}
            className="flex-1 bg-accent-dark text-white rounded-lg py-2 text-xs font-medium hover:bg-accent-dark/90 disabled:opacity-50"
          >
            {l.save}
          </button>
          {status === 'connected' && (
            <button
              onClick={handleSync}
              disabled={busy}
              className="px-3 border border-border rounded-lg py-2 text-xs text-text-secondary disabled:opacity-50"
            >
              {busy ? l.syncing : l.sync}
            </button>
          )}
        </div>

        <div className={`flex items-center gap-1.5 text-[11px] ${statusColors[status]}`}>
          <Icon name={icon[status]} size={14} />
          <span>{statusLabels[status]}</span>
          {errorMessage && <span className="text-text-tertiary truncate" title={errorMessage}>— {errorMessage}</span>}
        </div>
        {syncMessage && <div className="text-[10px] text-text-tertiary italic">{syncMessage}</div>}
      </div>
    </Card>
  );
}
