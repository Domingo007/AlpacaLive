import { useEffect, useState } from 'react';
import { Card } from '@/components/shared/Card';
import { Icon } from '@/components/shared/Icon';
import { useI18n } from '@/lib/i18n';
import { getSettings } from '@/lib/db';
import {
  buildAuthorizationUrl,
  consumeOauthState,
  disconnectStrava,
  exchangeCodeForToken,
  generateOauthState,
  isStravaConfigured,
  loadTokens,
  rememberOauthState,
  saveCredentials,
  saveTokens,
} from '@/lib/strava-client';
import { syncStrava } from '@/lib/strava-adapter';
import { SetupGuide } from './SetupGuide';

type Connection = 'disconnected' | 'connecting' | 'connected' | 'error';

export function StravaSettings() {
  const { lang } = useI18n();
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [credsConfigured, setCredsConfigured] = useState(false);
  const [connection, setConnection] = useState<Connection>('disconnected');
  const [errorMessage, setErrorMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const l = lang === 'pl' ? {
    title: 'Strava',
    desc: 'Strava daje dane o treningach (czas, dystans, średnie tętno) — przydatne do korelacji aktywności z energią. Wymaga rejestracji aplikacji w panelu Strava (raz, jednorazowo).',
    clientId: 'Client ID',
    clientSecret: 'Client Secret',
    redirectUri: 'Adres callback',
    redirectHint: 'Adres callback musi zgadzać się z tym wpisanym w „Authorization Callback Domain" Strava (w polu wpisz tylko domenę, np. localhost lub alpacalive.app — bez https://, bez ścieżki).',
    saveCreds: 'Zapisz dane',
    show: 'Pokaż',
    hide: 'Ukryj',
    connect: 'Połącz Stravę',
    disconnect: 'Rozłącz',
    sync: 'Synchronizuj 7 dni',
    syncing: 'Synchronizacja…',
    statusDisconnected: 'Niepołączono',
    statusConnecting: 'Łączenie…',
    statusConnected: 'Połączono',
    statusError: 'Błąd',
    syncedDays: (n: number) => `Zsynchronizowano ${n} dni`,
    syncError: 'Błąd synchronizacji',
    guideTitle: 'Krok po kroku — jak zarejestrować aplikację Strava?',
  } : lang === 'de' ? {
    title: 'Strava',
    desc: 'Strava liefert Trainingsdaten (Dauer, Distanz, durchschnittliche Herzfrequenz) — nützlich, um Aktivität mit Energie zu korrelieren. Erfordert die Registrierung einer App im Strava-Panel (einmalig).',
    clientId: 'Client ID',
    clientSecret: 'Client Secret',
    redirectUri: 'Callback-URL',
    redirectHint: 'Die Callback-URL muss mit dem übereinstimmen, was Sie als „Authorization Callback Domain" in Strava eingegeben haben (nur die Domain eingeben, z. B. localhost oder alpacalive.app — ohne https://, ohne Pfad).',
    saveCreds: 'Anmeldedaten speichern',
    show: 'Anzeigen',
    hide: 'Verbergen',
    connect: 'Strava verbinden',
    disconnect: 'Trennen',
    sync: '7 Tage synchronisieren',
    syncing: 'Synchronisierung…',
    statusDisconnected: 'Nicht verbunden',
    statusConnecting: 'Verbindung…',
    statusConnected: 'Verbunden',
    statusError: 'Fehler',
    syncedDays: (n: number) => `${n} Tage synchronisiert`,
    syncError: 'Synchronisierung fehlgeschlagen',
    guideTitle: 'Schritt für Schritt — wie registriere ich eine Strava-App?',
  } : {
    title: 'Strava',
    desc: 'Strava provides workout data (duration, distance, average heart rate) — useful to correlate activity with energy patterns. Requires registering an app in the Strava panel (one-time setup).',
    clientId: 'Client ID',
    clientSecret: 'Client Secret',
    redirectUri: 'Callback URL',
    redirectHint: 'The callback URL must match what you entered as "Authorization Callback Domain" in Strava (enter just the domain, e.g. localhost or alpacalive.app — no https://, no path).',
    saveCreds: 'Save credentials',
    show: 'Show',
    hide: 'Hide',
    connect: 'Connect Strava',
    disconnect: 'Disconnect',
    sync: 'Sync 7 days',
    syncing: 'Syncing…',
    statusDisconnected: 'Not connected',
    statusConnecting: 'Connecting…',
    statusConnected: 'Connected',
    statusError: 'Error',
    syncedDays: (n: number) => `Synced ${n} days`,
    syncError: 'Sync failed',
    guideTitle: 'Step-by-step — how do I register a Strava app?',
  };

  useEffect(() => {
    (async () => {
      const settings = await getSettings();
      if (settings) {
        setClientId(settings.stravaClientId ?? '');
        setClientSecret(settings.stravaClientSecret ?? '');
        setRedirectUri(settings.stravaRedirectUri ?? '');
      }
      setCredsConfigured(await isStravaConfigured());
      const tokens = await loadTokens();
      if (tokens) setConnection('connected');
    })();
  }, []);

  // OAuth callback handler — runs once on mount if URL has ?code=&state= and scope=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const scope = params.get('scope');
    // Strava callback is identifiable by the 'scope' parameter (Withings doesn't send it)
    if (!code || !state || !scope) return;
    if (!scope.includes('activity')) return; // not a Strava callback
    const expected = consumeOauthState();
    if (!expected || expected !== state) {
      setConnection('error');
      setErrorMessage('CSRF state mismatch');
      return;
    }
    setBusy(true);
    setConnection('connecting');
    exchangeCodeForToken(code)
      .then(saveTokens)
      .then(() => {
        setConnection('connected');
        setErrorMessage('');
        window.history.replaceState({}, '', window.location.pathname);
      })
      .catch(err => {
        setConnection('error');
        setErrorMessage(err instanceof Error ? err.message : 'unknown');
      })
      .finally(() => setBusy(false));
  }, []);

  async function handleSaveCreds() {
    await saveCredentials({
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      redirectUri: redirectUri.trim(),
    });
    setCredsConfigured(await isStravaConfigured());
  }

  async function handleConnect() {
    setBusy(true);
    try {
      const state = generateOauthState();
      rememberOauthState(state);
      const url = await buildAuthorizationUrl(state);
      window.location.href = url;
    } catch (err) {
      setConnection('error');
      setErrorMessage(err instanceof Error ? err.message : 'unknown');
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    await disconnectStrava();
    setConnection('disconnected');
  }

  async function handleSync() {
    setBusy(true);
    setSyncMessage('');
    try {
      const result = await syncStrava(7);
      setSyncMessage(result.success ? l.syncedDays(result.syncedDays) : l.syncError);
    } catch {
      setSyncMessage(l.syncError);
    } finally {
      setBusy(false);
      setTimeout(() => setSyncMessage(''), 3000);
    }
  }

  const guideSteps = lang === 'pl' ? [
    <>Wejdź na <a href="https://www.strava.com/settings/api" target="_blank" rel="noopener" className="text-lavender-700 underline">strava.com/settings/api</a> i zaloguj się swoim kontem Strava.<br /><span className="text-text-tertiary">[screenshot: panel API Strava]</span></>,
    <>Wypełnij formularz aplikacji. <strong>Application Name</strong> = AlpacaLive, <strong>Category</strong> = Health, <strong>Authorization Callback Domain</strong> = <code className="text-[10px] bg-bg-card px-1.5 py-0.5 rounded">localhost</code> (testy) lub Twoja domena. <em>Tylko domena</em>, bez https:// i bez ścieżki.<br /><span className="text-text-tertiary">[screenshot: formularz nowej aplikacji]</span></>,
    <>Po utworzeniu Strava pokaże <strong>Client ID</strong> i <strong>Client Secret</strong>. Skopiuj oba.<br /><span className="text-text-tertiary">[screenshot: ekran z credentials]</span></>,
    <>Wróć tutaj. Wklej Client ID i Client Secret. W „Adres callback" wpisz <em>pełny URL</em>: <code className="text-[10px] bg-bg-card px-1.5 py-0.5 rounded">http://localhost:5173/strava/callback</code> (lub Twoja domena + /strava/callback).</>,
    <>Kliknij <strong>Zapisz dane</strong>, potem <strong>Połącz Stravę</strong>. Otworzy się logowanie Strava — zaakceptuj dostęp i wrócisz do aplikacji.</>,
    <>Kliknij <strong>Synchronizuj 7 dni</strong> — ostatni tydzień treningów wyląduje w Daily Profile.</>,
  ] : lang === 'de' ? [
    <>Gehen Sie zu <a href="https://www.strava.com/settings/api" target="_blank" rel="noopener" className="text-lavender-700 underline">strava.com/settings/api</a> und melden Sie sich bei Ihrem Strava-Konto an.<br /><span className="text-text-tertiary">[Screenshot: Strava-API-Panel]</span></>,
    <>Füllen Sie das Antragsformular aus. <strong>Application Name</strong> = AlpacaLive, <strong>Category</strong> = Health, <strong>Authorization Callback Domain</strong> = <code className="text-[10px] bg-bg-card px-1.5 py-0.5 rounded">localhost</code> (Tests) oder Ihre Domain. <em>Nur Domain</em>, ohne https:// und ohne Pfad.<br /><span className="text-text-tertiary">[Screenshot: Neues App-Formular]</span></>,
    <>Nach der Erstellung zeigt Strava <strong>Client ID</strong> und <strong>Client Secret</strong>. Kopieren Sie beide.<br /><span className="text-text-tertiary">[Screenshot: Anmeldedaten-Anzeige]</span></>,
    <>Kommen Sie hierher zurück. Fügen Sie Client ID und Client Secret ein. In "Callback-URL" geben Sie die <em>vollständige URL</em> ein: <code className="text-[10px] bg-bg-card px-1.5 py-0.5 rounded">http://localhost:5173/strava/callback</code> (oder Ihre Domain + /strava/callback).</>,
    <>Klicken Sie auf <strong>Anmeldedaten speichern</strong>, dann auf <strong>Strava verbinden</strong>. Der Strava-Login-Bildschirm öffnet sich — Zugriff genehmigen und Sie kehren zur App zurück.</>,
    <>Klicken Sie auf <strong>7 Tage synchronisieren</strong> — die letzte Trainingswoche landet in Ihrem Daily Profile.</>,
  ] : [
    <>Go to <a href="https://www.strava.com/settings/api" target="_blank" rel="noopener" className="text-lavender-700 underline">strava.com/settings/api</a> and sign in to your Strava account.<br /><span className="text-text-tertiary">[screenshot: Strava API panel]</span></>,
    <>Fill in the application form. <strong>Application Name</strong> = AlpacaLive, <strong>Category</strong> = Health, <strong>Authorization Callback Domain</strong> = <code className="text-[10px] bg-bg-card px-1.5 py-0.5 rounded">localhost</code> (testing) or your domain. <em>Domain only</em>, no https:// and no path.<br /><span className="text-text-tertiary">[screenshot: new app form]</span></>,
    <>Once created, Strava shows <strong>Client ID</strong> and <strong>Client Secret</strong>. Copy both.<br /><span className="text-text-tertiary">[screenshot: credentials display]</span></>,
    <>Come back here. Paste Client ID and Client Secret. In "Callback URL" enter the <em>full URL</em>: <code className="text-[10px] bg-bg-card px-1.5 py-0.5 rounded">http://localhost:5173/strava/callback</code> (or your domain + /strava/callback).</>,
    <>Click <strong>Save credentials</strong>, then <strong>Connect Strava</strong>. The Strava login screen opens — approve access and you return to the app.</>,
    <>Click <strong>Sync 7 days</strong> — the last week of workouts lands in your Daily Profile.</>,
  ];

  const statusColors: Record<Connection, string> = {
    disconnected: 'text-text-tertiary',
    connecting: 'text-lavender-600',
    connected: 'text-accent-green',
    error: 'text-red-600',
  };
  const statusLabels: Record<Connection, string> = {
    disconnected: l.statusDisconnected,
    connecting: l.statusConnecting,
    connected: l.statusConnected,
    error: l.statusError,
  };

  return (
    <Card title={l.title}>
      <div className="space-y-3">
        <p className="text-[11px] text-text-secondary leading-relaxed">{l.desc}</p>

        <SetupGuide title={l.guideTitle} steps={guideSteps} />

        <div className="space-y-2">
          <Field label={l.clientId} value={clientId} onChange={setClientId} placeholder="123456" />
          <div>
            <label className="text-[11px] text-text-secondary block mb-1">{l.clientSecret}</label>
            <div className="flex gap-1">
              <input
                type={showSecret ? 'text' : 'password'}
                value={clientSecret}
                onChange={e => setClientSecret(e.target.value)}
                placeholder="•••••"
                className="flex-1 rounded-lg border border-border px-2.5 py-1.5 text-xs bg-bg-primary"
              />
              <button
                type="button"
                onClick={() => setShowSecret(s => !s)}
                className="px-2 border border-border rounded-lg text-[11px] text-text-secondary hover:bg-bg-primary"
              >
                {showSecret ? l.hide : l.show}
              </button>
            </div>
          </div>
          <Field label={l.redirectUri} value={redirectUri} onChange={setRedirectUri} placeholder="http://localhost:5173/strava/callback" />
          <p className="text-[10px] text-text-tertiary leading-relaxed bg-bg-primary rounded-lg px-2.5 py-2 border border-lavender-100">
            {l.redirectHint}
          </p>
          <button
            onClick={handleSaveCreds}
            className="w-full bg-bg-card border border-border rounded-lg py-1.5 text-xs text-text-secondary hover:bg-bg-primary"
          >
            {l.saveCreds}
          </button>
        </div>

        <div className="border-t border-lavender-100 pt-3 space-y-2">
          <div className={`flex items-center gap-1.5 text-[11px] ${statusColors[connection]}`}>
            <Icon
              name={connection === 'connected' ? 'check_circle' : connection === 'error' ? 'error' : 'radio_button_unchecked'}
              size={14}
            />
            <span>{statusLabels[connection]}</span>
            {errorMessage && <span className="text-text-tertiary truncate" title={errorMessage}>— {errorMessage}</span>}
          </div>

          <div className="flex gap-2">
            {connection !== 'connected' ? (
              <button
                onClick={handleConnect}
                disabled={!credsConfigured || busy}
                className="flex-1 bg-accent-dark text-white rounded-lg py-2 text-xs font-medium hover:bg-accent-dark/90 disabled:opacity-50"
              >
                {l.connect}
              </button>
            ) : (
              <>
                <button
                  onClick={handleSync}
                  disabled={busy}
                  className="flex-1 bg-accent-dark text-white rounded-lg py-2 text-xs font-medium disabled:opacity-50"
                >
                  {busy ? l.syncing : l.sync}
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={busy}
                  className="px-3 border border-border rounded-lg py-2 text-xs text-text-secondary"
                >
                  {l.disconnect}
                </button>
              </>
            )}
          </div>

          {syncMessage && <div className="text-[10px] text-text-tertiary italic">{syncMessage}</div>}
        </div>
      </div>
    </Card>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div>
      <label className="text-[11px] text-text-secondary block mb-1">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border px-2.5 py-1.5 text-xs bg-bg-primary"
      />
    </div>
  );
}
