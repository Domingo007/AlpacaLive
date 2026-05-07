import { useEffect, useState } from 'react';
import { Card } from '@/components/shared/Card';
import { Icon } from '@/components/shared/Icon';
import { useI18n } from '@/lib/i18n';
import { getSettings, saveSettings } from '@/lib/db';
import { openWearablesClient } from '@/lib/openwearables-client';

type Status = 'idle' | 'testing' | 'connected' | 'error';

const ENDPOINT_DEFAULT = 'http://localhost:8000';

function generateUserId(): string {
  return `aw_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function OpenWearablesSettings() {
  const { lang } = useI18n();
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [userId, setUserId] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const l = lang === 'pl' ? {
    title: 'Open Wearables (self-hosted)',
    desc: 'Open Wearables to platforma open-source unifikująca dane z 7+ urządzeń (Whoop, Garmin, Oura, Polar, Suunto, Strava, Ultrahuman). Uruchom u siebie przez docker compose i wpisz URL + klucz.',
    baseUrl: 'Adres serwera',
    apiKey: 'Klucz API',
    userId: 'Identyfikator użytkownika',
    regenerate: 'Wygeneruj',
    save: 'Zapisz',
    show: 'Pokaż',
    hide: 'Ukryj',
    test: 'Sprawdź połączenie',
    statusIdle: 'Niezapisane',
    statusTesting: 'Testowanie…',
    statusConnected: 'Połączono',
    statusError: 'Błąd',
    setupHint: 'Uruchom `docker compose up` w klonie github.com/the-momentum/open-wearables, potem skopiuj API key z panelu admin pod localhost:3000.',
  } : {
    title: 'Open Wearables (self-hosted)',
    desc: 'Open Wearables is an open-source platform unifying data from 7+ wearables (Whoop, Garmin, Oura, Polar, Suunto, Strava, Ultrahuman). Run it yourself via docker compose, then paste the URL + key.',
    baseUrl: 'Server URL',
    apiKey: 'API Key',
    userId: 'User ID',
    regenerate: 'Generate',
    save: 'Save',
    show: 'Show',
    hide: 'Hide',
    test: 'Test connection',
    statusIdle: 'Unsaved',
    statusTesting: 'Testing…',
    statusConnected: 'Connected',
    statusError: 'Error',
    setupHint: 'Run `docker compose up` in a clone of github.com/the-momentum/open-wearables, then copy the API key from the admin panel at localhost:3000.',
  };

  useEffect(() => {
    (async () => {
      const settings = await getSettings();
      if (settings) {
        setBaseUrl(settings.openWearablesBaseUrl ?? '');
        setApiKey(settings.openWearablesApiKey ?? '');
        setUserId(settings.openWearablesUserId ?? '');
      }
    })();
  }, []);

  async function handleSave() {
    const finalUserId = userId.trim() || generateUserId();
    if (finalUserId !== userId) setUserId(finalUserId);
    await saveSettings({
      openWearablesBaseUrl: baseUrl.trim() || undefined,
      openWearablesApiKey: apiKey.trim() || undefined,
      openWearablesUserId: finalUserId,
    });
    await testConnection();
  }

  async function testConnection() {
    if (!baseUrl.trim() || !apiKey.trim()) {
      setStatus('error');
      setErrorMessage(l.statusIdle);
      return;
    }
    setStatus('testing');
    setErrorMessage('');
    try {
      await openWearablesClient.listConnections();
      setStatus('connected');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'unknown');
    }
  }

  function regenerateUserId() {
    setUserId(generateUserId());
  }

  return (
    <Card title={l.title}>
      <div className="space-y-3">
        <p className="text-[11px] text-text-secondary leading-relaxed">{l.desc}</p>

        <div className="space-y-2">
          <Field
            label={l.baseUrl}
            value={baseUrl}
            onChange={setBaseUrl}
            placeholder={ENDPOINT_DEFAULT}
          />

          <div>
            <label className="text-[11px] text-text-secondary block mb-1">{l.apiKey}</label>
            <div className="flex gap-1">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-ow-…"
                className="flex-1 rounded-lg border border-border px-2.5 py-1.5 text-xs bg-bg-primary"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(s => !s)}
                className="px-2 border border-border rounded-lg text-[11px] text-text-secondary hover:bg-bg-primary"
              >
                {showApiKey ? l.hide : l.show}
              </button>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-text-secondary block mb-1">{l.userId}</label>
            <div className="flex gap-1">
              <input
                value={userId}
                onChange={e => setUserId(e.target.value)}
                placeholder="aw_…"
                className="flex-1 rounded-lg border border-border px-2.5 py-1.5 text-xs bg-bg-primary font-mono"
              />
              <button
                type="button"
                onClick={regenerateUserId}
                className="px-2 border border-border rounded-lg text-[11px] text-text-secondary hover:bg-bg-primary"
              >
                {l.regenerate}
              </button>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-text-tertiary leading-relaxed bg-bg-primary rounded-lg px-2.5 py-2 border border-lavender-100">
          {l.setupHint}
        </p>

        <div className="flex gap-2 items-center">
          <button
            onClick={handleSave}
            className="flex-1 bg-accent-dark text-white rounded-lg py-2 text-xs font-medium hover:bg-accent-dark/90"
          >
            {l.save}
          </button>
          <button
            onClick={testConnection}
            type="button"
            className="px-3 border border-border rounded-lg py-2 text-xs text-text-secondary hover:bg-bg-primary"
          >
            {l.test}
          </button>
        </div>

        <StatusRow status={status} labels={l} errorMessage={errorMessage} />
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

function StatusRow({
  status,
  labels,
  errorMessage,
}: {
  status: Status;
  labels: { statusIdle: string; statusTesting: string; statusConnected: string; statusError: string };
  errorMessage: string;
}) {
  const colors: Record<Status, string> = {
    idle: 'text-text-tertiary',
    testing: 'text-lavender-600',
    connected: 'text-accent-green',
    error: 'text-red-600',
  };
  const labelMap: Record<Status, string> = {
    idle: labels.statusIdle,
    testing: labels.statusTesting,
    connected: labels.statusConnected,
    error: labels.statusError,
  };
  const icon: Record<Status, string> = {
    idle: 'radio_button_unchecked',
    testing: 'progress_activity',
    connected: 'check_circle',
    error: 'error',
  };
  return (
    <div className={`flex items-center gap-1.5 text-[11px] ${colors[status]}`}>
      <Icon name={icon[status]} size={14} />
      <span>{labelMap[status]}</span>
      {status === 'error' && errorMessage && (
        <span className="text-text-tertiary truncate" title={errorMessage}>— {errorMessage}</span>
      )}
    </div>
  );
}
