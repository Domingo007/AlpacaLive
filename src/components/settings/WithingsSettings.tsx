import { useEffect, useState } from 'react';
import { Card } from '@/components/shared/Card';
import { Icon } from '@/components/shared/Icon';
import { useI18n } from '@/lib/i18n';
import { getSettings } from '@/lib/db';
import {
  buildAuthorizationUrl,
  consumeOauthState,
  disconnectWithings,
  exchangeCodeForToken,
  generateOauthState,
  isWithingsConfigured,
  loadTokens,
  rememberOauthState,
  saveCredentials,
  saveTokens,
} from '@/lib/withings-client';
import { syncWithings } from '@/lib/withings-adapter';

type Connection = 'disconnected' | 'connecting' | 'connected' | 'error';

export function WithingsSettings() {
  const { lang } = useI18n();
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [credsConfigured, setCredsConfigured] = useState(false);
  const [connection, setConnection] = useState<Connection>('disconnected');
  const [errorMessage, setErrorMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const l = lang === 'pl' ? {
    title: 'Withings (bezpośrednia integracja)',
    desc: 'Withings dostarcza sygnały medycznej klasy: ESC dla CIPN, ScanWatch ECG, body composition, BPM. Zarejestruj aplikację w developer.withings.com, wpisz Client ID, Client Secret i adres callback, potem kliknij „Połącz".',
    clientId: 'Client ID',
    clientSecret: 'Client Secret',
    redirectUri: 'Adres callback (Redirect URI)',
    redirectHint: 'Adres callback musi zgadzać się z tym wpisanym w panelu Withings. Dla developmentu zwykle: http://localhost:5173/withings/callback',
    saveCreds: 'Zapisz dane',
    show: 'Pokaż',
    hide: 'Ukryj',
    connect: 'Połącz z Withings',
    disconnect: 'Rozłącz',
    sync: 'Synchronizuj teraz',
    statusDisconnected: 'Niepołączono',
    statusConnecting: 'Łączenie…',
    statusConnected: 'Połączono',
    statusError: 'Błąd',
    escNote: 'ESC (przewodnictwo elektrochemiczne skóry, monitoring CIPN) wymaga Body Scan lub Body Pro 2 ESC. Dostępność może być ograniczona w niektórych regionach.',
  } : {
    title: 'Withings (direct integration)',
    desc: 'Withings provides medical-grade signals: ESC for CIPN monitoring, ScanWatch ECG, body composition, BP. Register an app at developer.withings.com, paste the Client ID, Client Secret and callback URL, then click "Connect".',
    clientId: 'Client ID',
    clientSecret: 'Client Secret',
    redirectUri: 'Callback URL (Redirect URI)',
    redirectHint: 'The callback URL must match what you entered in the Withings dashboard. For development typically: http://localhost:5173/withings/callback',
    saveCreds: 'Save credentials',
    show: 'Show',
    hide: 'Hide',
    connect: 'Connect Withings',
    disconnect: 'Disconnect',
    sync: 'Sync now',
    statusDisconnected: 'Not connected',
    statusConnecting: 'Connecting…',
    statusConnected: 'Connected',
    statusError: 'Error',
    escNote: 'ESC (electrochemical skin conductance, for CIPN monitoring) requires Body Scan or Body Pro 2 ESC. Availability may be limited in some regions.',
  };

  useEffect(() => {
    (async () => {
      const settings = await getSettings();
      if (settings) {
        setClientId(settings.withingsClientId ?? '');
        setClientSecret(settings.withingsClientSecret ?? '');
        setRedirectUri(settings.withingsRedirectUri ?? '');
      }
      setCredsConfigured(await isWithingsConfigured());
      const tokens = await loadTokens();
      if (tokens && tokens.accessToken) setConnection('connected');
    })();
  }, []);

  // OAuth callback handler — runs once on mount if URL has ?code=&state=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state) return;
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
      .catch((err) => {
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
    setCredsConfigured(await isWithingsConfigured());
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
    await disconnectWithings();
    setConnection('disconnected');
  }

  async function handleSync() {
    setBusy(true);
    try {
      const result = await syncWithings(7);
      setErrorMessage(result.success ? `${result.syncedDays} ✓` : (result.errors[0] ?? 'unknown'));
      if (!result.success) setConnection('error');
    } finally {
      setBusy(false);
    }
  }

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

        <div className="space-y-2">
          <Field label={l.clientId} value={clientId} onChange={setClientId} placeholder="abcdef…" />
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
          <Field label={l.redirectUri} value={redirectUri} onChange={setRedirectUri} placeholder="http://localhost:5173/withings/callback" />
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
            <Icon name={connection === 'connected' ? 'check_circle' : connection === 'error' ? 'error' : 'radio_button_unchecked'} size={14} />
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
                  {l.sync}
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
        </div>

        <p className="text-[10px] text-text-tertiary italic leading-relaxed">{l.escNote}</p>
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
