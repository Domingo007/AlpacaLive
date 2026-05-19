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
import { SetupGuide } from './SetupGuide';

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
    guideTitle: 'Krok po kroku — jak uzyskać Client ID i Secret?',
  } : lang === 'de' ? {
    title: 'Withings (direkte Integration)',
    desc: 'Withings liefert Signale in medizinischer Qualität: ESC für CIPN-Überwachung, ScanWatch EKG, Körperzusammensetzung, BD. Registrieren Sie eine App auf developer.withings.com, fügen Sie Client ID, Client Secret und Callback-URL ein, dann klicken Sie auf „Verbinden".',
    clientId: 'Client ID',
    clientSecret: 'Client Secret',
    redirectUri: 'Callback-URL (Redirect URI)',
    redirectHint: 'Die Callback-URL muss mit der im Withings-Dashboard eingegebenen übereinstimmen. Für die Entwicklung normalerweise: http://localhost:5173/withings/callback',
    saveCreds: 'Anmeldedaten speichern',
    show: 'Anzeigen',
    hide: 'Verbergen',
    connect: 'Withings verbinden',
    disconnect: 'Trennen',
    sync: 'Jetzt synchronisieren',
    statusDisconnected: 'Nicht verbunden',
    statusConnecting: 'Verbindung…',
    statusConnected: 'Verbunden',
    statusError: 'Fehler',
    escNote: 'ESC (elektrochemische Hautleitfähigkeit für CIPN-Überwachung) erfordert Body Scan oder Body Pro 2 ESC. Verfügbarkeit kann in einigen Regionen eingeschränkt sein.',
    guideTitle: 'Schritt für Schritt — wie bekomme ich eine Client ID und Secret?',
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
    guideTitle: 'Step-by-step — how do I get a Client ID and Secret?',
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

  const guideSteps = lang === 'pl' ? [
    <>Wejdź na <a href="https://developer.withings.com/dashboard/" target="_blank" rel="noopener" className="text-lavender-700 underline">developer.withings.com/dashboard</a> i zaloguj się swoim kontem Withings (tym samym, którego używasz w aplikacji Withings Health Mate).<br /><span className="text-text-tertiary">[screenshot: strona logowania Withings developer]</span></>,
    <>Po zalogowaniu kliknij <strong>Create an application</strong>. Wybierz typ <strong>Public API integration</strong>.<br /><span className="text-text-tertiary">[screenshot: lista aplikacji + przycisk Create]</span></>,
    <>Wypełnij formularz: <strong>Application name</strong> = AlpacaLive (lub dowolnie), <strong>Description</strong> = krótki opis, <strong>Logo</strong> = opcjonalne. Najważniejsze: <strong>Callback URI</strong> wpisz <em>dokładnie ten sam adres</em> co poniżej w polu „Adres callback".<br /><span className="text-text-tertiary">[screenshot: formularz nowej aplikacji]</span></>,
    <>Po utworzeniu aplikacji Withings pokaże <strong>Client ID</strong> i <strong>Client Secret</strong>. <em>Skopiuj oba</em> — Client Secret zobaczysz tylko raz!<br /><span className="text-text-tertiary">[screenshot: ekran z credentials]</span></>,
    <>Wróć tutaj. Wklej <strong>Client ID</strong> i <strong>Client Secret</strong>. W pole „Adres callback" wpisz dokładnie to samo co w panelu Withings (zwykle <code className="text-[10px] bg-bg-card px-1.5 py-0.5 rounded">http://localhost:5173/withings/callback</code> dla testów).</>,
    <>Kliknij <strong>Zapisz dane</strong>, potem <strong>Połącz z Withings</strong>. Otworzy się ekran logowania Withings — zatwierdź dostęp i wrócisz do aplikacji.</>,
    <>Po połączeniu kliknij <strong>Synchronizuj teraz</strong> — pobiera ostatnie 7 dni danych. Token jest automatycznie odświeżany (Withings rotuje refresh token).</>,
    <>Pełna dokumentacja Withings API: <a href="https://developer.withings.com/api-reference/" target="_blank" rel="noopener" className="text-lavender-700 underline">developer.withings.com/api-reference</a></>,
  ] : lang === 'de' ? [
    <>Gehen Sie zu <a href="https://developer.withings.com/dashboard/" target="_blank" rel="noopener" className="text-lavender-700 underline">developer.withings.com/dashboard</a> und melden Sie sich mit Ihrem Withings-Konto an (dem gleichen, das in Withings Health Mate verwendet wird).<br /><span className="text-text-tertiary">[Screenshot: Withings-Developer-Login]</span></>,
    <>Nach der Anmeldung klicken Sie auf <strong>Create an application</strong>. Wählen Sie den Typ <strong>Public API integration</strong>.<br /><span className="text-text-tertiary">[Screenshot: App-Liste + Erstellen-Schaltfläche]</span></>,
    <>Füllen Sie das Formular aus: <strong>Application name</strong> = AlpacaLive (oder beliebig), <strong>Description</strong> = kurze Beschreibung, <strong>Logo</strong> = optional. Wichtigstes Feld: <strong>Callback URI</strong> muss <em>genau</em> mit dem übereinstimmen, was Sie unten im Feld "Callback-URL" eingeben.<br /><span className="text-text-tertiary">[Screenshot: Neues App-Formular]</span></>,
    <>Nach der Erstellung zeigt Withings die <strong>Client ID</strong> und das <strong>Client Secret</strong>. <em>Kopieren Sie beide</em> — das Client Secret wird nur einmal angezeigt!<br /><span className="text-text-tertiary">[Screenshot: Anmeldedaten-Bildschirm]</span></>,
    <>Kommen Sie hierher zurück. Fügen Sie <strong>Client ID</strong> und <strong>Client Secret</strong> ein. In "Callback-URL" geben Sie genau den Wert ein, den Sie im Withings-Dashboard eingegeben haben (normalerweise <code className="text-[10px] bg-bg-card px-1.5 py-0.5 rounded">http://localhost:5173/withings/callback</code> für lokale Tests).</>,
    <>Klicken Sie auf <strong>Anmeldedaten speichern</strong>, dann auf <strong>Withings verbinden</strong>. Der Withings-Login-Bildschirm öffnet sich — Zugriff genehmigen und Sie kehren zur App zurück.</>,
    <>Nach der Verbindung klicken Sie auf <strong>Jetzt synchronisieren</strong> — die letzten 7 Tage werden abgerufen. Token werden automatisch aktualisiert (Withings rotiert den Refresh-Token).</>,
    <>Vollständige Withings-API-Dokumentation: <a href="https://developer.withings.com/api-reference/" target="_blank" rel="noopener" className="text-lavender-700 underline">developer.withings.com/api-reference</a></>,
  ] : [
    <>Go to <a href="https://developer.withings.com/dashboard/" target="_blank" rel="noopener" className="text-lavender-700 underline">developer.withings.com/dashboard</a> and sign in with your Withings account (the same one used in Withings Health Mate).<br /><span className="text-text-tertiary">[screenshot: Withings developer login]</span></>,
    <>Once signed in, click <strong>Create an application</strong>. Pick the <strong>Public API integration</strong> type.<br /><span className="text-text-tertiary">[screenshot: app list + Create button]</span></>,
    <>Fill in the form: <strong>Application name</strong> = AlpacaLive (or anything), <strong>Description</strong> = a short blurb, <strong>Logo</strong> = optional. Critical field: <strong>Callback URI</strong> must match <em>exactly</em> what you enter in the "Callback URL" field below.<br /><span className="text-text-tertiary">[screenshot: new application form]</span></>,
    <>Once created, Withings shows the <strong>Client ID</strong> and <strong>Client Secret</strong>. <em>Copy both</em> — the Client Secret is shown only once!<br /><span className="text-text-tertiary">[screenshot: credentials screen]</span></>,
    <>Come back here. Paste <strong>Client ID</strong> and <strong>Client Secret</strong>. In "Callback URL" enter the exact same value you entered in the Withings dashboard (usually <code className="text-[10px] bg-bg-card px-1.5 py-0.5 rounded">http://localhost:5173/withings/callback</code> for local testing).</>,
    <>Click <strong>Save credentials</strong>, then <strong>Connect Withings</strong>. The Withings login screen opens — approve access and you return to the app.</>,
    <>Once connected, click <strong>Sync now</strong> — pulls the last 7 days of data. Tokens auto-refresh (Withings rotates the refresh token).</>,
    <>Full Withings API docs: <a href="https://developer.withings.com/api-reference/" target="_blank" rel="noopener" className="text-lavender-700 underline">developer.withings.com/api-reference</a></>,
  ];

  return (
    <Card title={l.title}>
      <div className="space-y-3">
        <p className="text-[11px] text-text-secondary leading-relaxed">{l.desc}</p>

        <SetupGuide title={l.guideTitle} steps={guideSteps} />

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
