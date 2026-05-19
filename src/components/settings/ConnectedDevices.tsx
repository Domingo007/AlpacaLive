import { useState, useRef } from 'react';
import { Card } from '@/components/shared/Card';
import { Icon } from '@/components/shared/Icon';
import { useI18n } from '@/lib/i18n';
import { parseHealthDataFromText } from '@/lib/devices/apple-health-import';
import { detectFormat, parseCsvHeaders, applyMapping, parseGarminCsv, parseWithingsCsv, parseJsonImport } from '@/lib/devices/csv-import';
import { saveNormalizedData, generateImportPreview } from '@/lib/devices/data-mapper';
import type { NormalizedDeviceData, ImportResult } from '@/lib/devices/types';

export function ConnectedDevices() {
  const { lang } = useI18n();
  const [pasteText, setPasteText] = useState('');
  const [showPaste, setShowPaste] = useState<'apple' | 'android' | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [csvPreview, setCsvPreview] = useState<{ rows: NormalizedDeviceData[]; source: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const l = lang === 'pl' ? {
    title: 'Połączone urządzenia',
    appleTitle: 'Apple Health (iPhone)',
    appleDesc: 'Użyj Skrótu iOS do automatycznego przesyłania danych zdrowotnych.',
    appleDownload: 'Pobierz Skrót iOS',
    appleShortcutSteps: '1. Pobierz Skrót → 2. Otwórz w Skrótach → 3. Uruchom → dane trafią do aplikacji',
    androidTitle: 'Android (Health Connect)',
    androidDesc: 'Użyj Automate lub Tasker do przesyłania danych z Health Connect.',
    androidDownload: 'Pobierz profil Automate',
    androidSteps: '1. Zainstaluj Automate (darmowy) → 2. Pobierz profil → 3. Uruchom → dane trafią do aplikacji',
    pasteData: 'Wklej dane JSON',
    pasteHint: 'Wklej JSON skopiowany ze Skrótu/Automate...',
    import: 'Importuj',
    cancel: 'Anuluj',
    csvTitle: 'Import z pliku (CSV/JSON)',
    csvDesc: 'Importuj eksport z Garmin Connect, Withings, Samsung Health lub dowolny CSV.',
    csvButton: 'Wybierz plik',
    success: 'Zaimportowano',
    inserted: 'nowych',
    updated: 'zaktualizowanych',
    skipped: 'pominiętych',
    preview: 'Podgląd danych',
    confirmImport: 'Potwierdź import',
    rows: 'wierszy',
  } : lang === 'de' ? {
    title: 'Verbundene Geräte',
    appleTitle: 'Apple Health (iPhone)',
    appleDesc: 'Verwenden Sie ein iOS-Kurzbefehl, um Gesundheitsdaten automatisch zu senden.',
    appleDownload: 'iOS-Kurzbefehl herunterladen',
    appleShortcutSteps: '1. Kurzbefehl herunterladen → 2. In Kurzbefehlen öffnen → 3. Ausführen → Daten landen in der App',
    androidTitle: 'Android (Health Connect)',
    androidDesc: 'Verwenden Sie Automate oder Tasker, um Daten von Health Connect zu senden.',
    androidDownload: 'Automate-Profil herunterladen',
    androidSteps: '1. Automate installieren (kostenlos) → 2. Profil herunterladen → 3. Ausführen → Daten landen in der App',
    pasteData: 'JSON-Daten einfügen',
    pasteHint: 'JSON aus Kurzbefehl/Automate einfügen...',
    import: 'Importieren',
    cancel: 'Abbrechen',
    csvTitle: 'Aus Datei importieren (CSV/JSON)',
    csvDesc: 'Importieren Sie Exporte aus Garmin Connect, Withings, Samsung Health oder jede CSV.',
    csvButton: 'Datei wählen',
    success: 'Importiert',
    inserted: 'neu',
    updated: 'aktualisiert',
    skipped: 'übersprungen',
    preview: 'Datenvorschau',
    confirmImport: 'Import bestätigen',
    rows: 'Zeilen',
  } : {
    title: 'Connected Devices',
    appleTitle: 'Apple Health (iPhone)',
    appleDesc: 'Use an iOS Shortcut to automatically send health data.',
    appleDownload: 'Download iOS Shortcut',
    appleShortcutSteps: '1. Download Shortcut → 2. Open in Shortcuts → 3. Run → data goes to app',
    androidTitle: 'Android (Health Connect)',
    androidDesc: 'Use Automate or Tasker to send data from Health Connect.',
    androidDownload: 'Download Automate profile',
    androidSteps: '1. Install Automate (free) → 2. Download profile → 3. Run → data goes to app',
    pasteData: 'Paste JSON data',
    pasteHint: 'Paste JSON copied from Shortcut/Automate...',
    import: 'Import',
    cancel: 'Cancel',
    csvTitle: 'Import from file (CSV/JSON)',
    csvDesc: 'Import exports from Garmin Connect, Withings, Samsung Health, or any CSV.',
    csvButton: 'Choose file',
    success: 'Imported',
    inserted: 'new',
    updated: 'updated',
    skipped: 'skipped',
    preview: 'Data preview',
    confirmImport: 'Confirm import',
    rows: 'rows',
  };

  async function handlePasteImport() {
    const data = parseHealthDataFromText(pasteText);
    if (!data || data.length === 0) return;
    const result = await saveNormalizedData(data);
    setImportResult(result);
    setPasteText('');
    setShowPaste(null);
    setTimeout(() => setImportResult(null), 5000);
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const content = await file.text();
    const format = detectFormat(content, file.name);

    let rows: NormalizedDeviceData[] = [];

    if (format === 'json') {
      rows = parseJsonImport(content);
    } else if (format === 'garmin_csv') {
      rows = parseGarminCsv(content);
    } else if (format === 'withings_csv') {
      rows = parseWithingsCsv(content);
    } else if (format === 'generic_csv') {
      const parsed = parseCsvHeaders(content);
      rows = applyMapping(parsed.rows, parsed.suggestedMapping);
    }

    if (rows.length > 0) {
      setCsvPreview({ rows, source: format });
    }

    e.target.value = '';
  }

  async function handleConfirmCsvImport() {
    if (!csvPreview) return;
    const result = await saveNormalizedData(csvPreview.rows);
    setImportResult(result);
    setCsvPreview(null);
    setTimeout(() => setImportResult(null), 5000);
  }

  return (
    <Card title={l.title}>
      <div className="space-y-4">
        {/* Import result toast */}
        {importResult && (
          <div className="bg-accent-green/10 rounded-lg px-3 py-2 flex items-center gap-2 text-xs">
            <Icon name="check_circle" size={16} className="text-accent-green" />
            <span className="text-accent-green font-medium">
              {l.success}: {importResult.inserted} {l.inserted}, {importResult.updated} {l.updated}, {importResult.skipped} {l.skipped}
            </span>
          </div>
        )}

        {/* Apple Health */}
        <DeviceSection
          icon="favorite"
          title={l.appleTitle}
          description={l.appleDesc}
          steps={l.appleShortcutSteps}
          onPaste={() => setShowPaste(showPaste === 'apple' ? null : 'apple')}
          pasteLabel={l.pasteData}
        />

        {showPaste === 'apple' && (
          <PasteArea
            value={pasteText}
            onChange={setPasteText}
            placeholder={l.pasteHint}
            onImport={handlePasteImport}
            onCancel={() => { setShowPaste(null); setPasteText(''); }}
            importLabel={l.import}
            cancelLabel={l.cancel}
          />
        )}

        {/* Android */}
        <DeviceSection
          icon="android"
          title={l.androidTitle}
          description={l.androidDesc}
          steps={l.androidSteps}
          onPaste={() => setShowPaste(showPaste === 'android' ? null : 'android')}
          pasteLabel={l.pasteData}
        />

        {showPaste === 'android' && (
          <PasteArea
            value={pasteText}
            onChange={setPasteText}
            placeholder={l.pasteHint}
            onImport={handlePasteImport}
            onCancel={() => { setShowPaste(null); setPasteText(''); }}
            importLabel={l.import}
            cancelLabel={l.cancel}
          />
        )}

        {/* CSV/JSON Import */}
        <div className="bg-bg-primary rounded-xl border border-border p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Icon name="upload_file" size={20} className="text-lavender-500" />
            <div>
              <div className="text-xs font-medium">{l.csvTitle}</div>
              <div className="text-[10px] text-text-secondary">{l.csvDesc}</div>
            </div>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 bg-bg-card border border-border rounded-lg py-2 text-xs font-medium text-accent-dark hover:bg-accent-warm/20 transition-colors"
          >
            <Icon name="folder_open" size={16} />
            {l.csvButton}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,.xml"
            className="hidden"
            onChange={handleFileImport}
          />
        </div>

        {/* CSV Preview */}
        {csvPreview && (
          <div className="bg-bg-card rounded-xl border border-accent-dark p-3 space-y-2">
            <div className="text-xs font-medium text-accent-dark">{l.preview}</div>
            <div className="text-[10px] text-text-secondary">
              {csvPreview.rows.length} {l.rows} ({csvPreview.source})
            </div>
            <div className="max-h-32 overflow-y-auto text-[10px] font-mono bg-bg-primary rounded p-2">
              {csvPreview.rows.slice(0, 5).map((row, i) => (
                <div key={i} className="truncate">
                  {row.date}: {Object.entries(row).filter(([k]) => k !== 'date' && k !== 'source').map(([k, v]) => `${k}=${v}`).join(', ')}
                </div>
              ))}
              {csvPreview.rows.length > 5 && <div className="text-text-tertiary">...+{csvPreview.rows.length - 5}</div>}
            </div>
            <div className="flex gap-2">
              <button onClick={handleConfirmCsvImport}
                className="flex-1 bg-accent-dark text-white rounded-lg py-2 text-xs font-medium">
                {l.confirmImport}
              </button>
              <button onClick={() => setCsvPreview(null)}
                className="px-4 border border-border rounded-lg py-2 text-xs text-text-secondary">
                {l.cancel}
              </button>
            </div>
          </div>
        )}

      </div>
    </Card>
  );
}

// ==================== SUB-COMPONENTS ====================

function DeviceSection({ icon, title, description, steps, onPaste, pasteLabel }: {
  icon: string; title: string; description: string; steps: string; onPaste: () => void; pasteLabel: string;
}) {
  return (
    <div className="bg-bg-primary rounded-xl border border-border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Icon name={icon} size={20} className="text-accent-dark" />
        <div>
          <div className="text-xs font-medium">{title}</div>
          <div className="text-[10px] text-text-secondary">{description}</div>
        </div>
      </div>
      <div className="text-[10px] text-text-tertiary bg-bg-card rounded-lg px-2.5 py-1.5 leading-relaxed">
        {steps}
      </div>
      <button
        onClick={onPaste}
        className="w-full flex items-center justify-center gap-1.5 border border-border rounded-lg py-1.5 text-[11px] text-accent-dark hover:bg-accent-warm/20 transition-colors"
      >
        <Icon name="content_paste" size={14} />
        {pasteLabel}
      </button>
    </div>
  );
}

function PasteArea({ value, onChange, placeholder, onImport, onCancel, importLabel, cancelLabel }: {
  value: string; onChange: (v: string) => void; placeholder: string;
  onImport: () => void; onCancel: () => void; importLabel: string; cancelLabel: string;
}) {
  return (
    <div className="bg-bg-card rounded-lg border border-accent-dark/30 p-2.5 space-y-2">
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded border border-border px-2.5 py-2 text-[11px] font-mono bg-bg-primary resize-y"
      />
      <div className="flex gap-2">
        <button onClick={onImport} disabled={!value.trim()}
          className="flex-1 bg-accent-dark text-white rounded-lg py-2 text-xs font-medium disabled:opacity-40">
          {importLabel}
        </button>
        <button onClick={onCancel}
          className="px-4 border border-border rounded-lg py-2 text-xs text-text-secondary">
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
