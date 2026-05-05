import { useState, useEffect } from 'react';
import { usePatient, useSettings } from '@/hooks/useDatabase';
import { Card } from '@/components/shared/Card';
import { Icon } from '@/components/shared/Icon';
import { HistoricalImport } from './HistoricalImport';
import { ConnectedDevices } from './ConnectedDevices';
import { NotificationSettings } from './NotificationSettings';
import { AIProviderSettings } from './AIProviderSettings';
import { EducationView } from '@/components/education/EducationView';
import { LanguageSelector } from '@/components/shared/LanguageSelector';
import { exportAllData, importData, clearAllData, saveSettings } from '@/lib/db';
import { loadDemoData, exitDemoData } from '@/lib/demo-data';
import {
  isFileSystemAccessSupported,
  pickBackupFolder,
  writeBackupToFolder,
  removeBackupFolder,
  getBackupFolderName,
  getLatestBackupInfo,
  restoreFromBackup,
  downloadBackup,
} from '@/lib/auto-backup';
import { useI18n, type Lang } from '@/lib/i18n';
import type { DrugEntry, ThemeMode } from '@/types';

export function SettingsView() {
  const { patient } = usePatient();
  const { settings, update: updateSettings } = useSettings();
  const { t, lang, setLang } = useI18n();
  const [demoLoading, setDemoLoading] = useState(false);
  const [showEducation, setShowEducation] = useState(false);

  // Auto-backup state
  const [backupFolder, setBackupFolder] = useState<string | null>(null);
  const [backupInfo, setBackupInfo] = useState<{ date: string; size: string } | null>(null);
  const [backupStatus, setBackupStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const fsSupported = isFileSystemAccessSupported();

  useEffect(() => {
    getBackupFolderName().then(setBackupFolder);
    getLatestBackupInfo().then(setBackupInfo);
  }, []);

  const isDemo = settings?.demoMode === true || localStorage.getItem('alpacalive_demo_active') === 'true';

  if (showEducation) {
    return <EducationView onClose={() => setShowEducation(false)} />;
  }

  async function handleExport() {
    const json = await exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alpacalive-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      await importData(text);
      window.location.reload();
    };
    input.click();
  }

  async function handleReset() {
    if (confirm(t.settings.resetConfirm1)) {
      if (confirm(t.settings.resetConfirm2)) {
        await clearAllData();
        window.location.reload();
      }
    }
  }

  return (
    <div className="h-full overflow-y-auto px-3 py-4 space-y-4">
      <h2 className="font-display text-lg font-semibold text-accent-dark">{t.settings.title}</h2>

      {/* Language */}
      <Card title={t.settings.language}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium">{t.settings.language}</div>
            <div className="text-[10px] text-text-secondary">{t.settings.languageDesc}</div>
          </div>
          <LanguageSelector />
        </div>
      </Card>

      {/* Patient Education */}
      {patient?.diseaseProfileId && (
        <Card title={lang === 'pl' ? 'Wiedza pacjenta' : 'Patient Education'}>
          <button
            onClick={() => setShowEducation(true)}
            className="w-full flex items-center gap-3 p-2 rounded-xl bg-gradient-to-r from-accent-warm to-lavender-100 hover:from-lavender-100 hover:to-accent-warm transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-accent-dark flex items-center justify-center shrink-0">
              <Icon name="school" size={22} className="text-white" />
            </div>
            <div className="text-left flex-1">
              <div className="text-xs font-medium text-text-primary">
                {lang === 'pl' ? 'Słownik, poradniki faz, FAQ' : 'Glossary, phase guides, FAQ'}
              </div>
              <div className="text-[10px] text-text-secondary">
                {lang === 'pl' ? 'Materiały edukacyjne dopasowane do Twojej choroby' : 'Educational materials tailored to your condition'}
              </div>
            </div>
            <Icon name="chevron_right" size={18} className="text-text-tertiary shrink-0" />
          </button>
        </Card>
      )}

      {/* Demo Mode */}
      <Card title={t.settings.demoMode}>
        <div className="space-y-3">
          {isDemo ? (
            <>
              <div className="flex items-center gap-2 rounded-lg bg-lavender-100 dark:bg-lavender-200 p-2.5">
                <Icon name="info" size={18} className="text-accent-dark shrink-0" />
                <p className="text-xs text-accent-dark leading-relaxed">
                  {t.settings.demoActiveInfo}
                </p>
              </div>
              <button
                onClick={async () => {
                  if (!confirm(t.settings.exitDemoConfirm)) return;
                  await exitDemoData();
                  window.location.reload();
                }}
                className="w-full rounded-lg py-2.5 text-sm font-medium border-2 border-alert-critical text-alert-critical hover:bg-alert-critical/10 transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="logout" size={18} />
                {t.settings.exitDemo}
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-text-secondary leading-relaxed">
                {t.settings.demoModeDesc}
              </p>
              <button
                onClick={async () => {
                  if (!confirm(t.settings.loadDemoConfirm)) return;
                  setDemoLoading(true);
                  try {
                    await loadDemoData();
                    window.location.reload();
                  } catch {
                    setDemoLoading(false);
                  }
                }}
                disabled={demoLoading}
                className={`w-full rounded-lg py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  demoLoading
                    ? 'bg-lavender-200 text-text-secondary cursor-wait'
                    : 'bg-gradient-to-r from-lavender-500 to-accent-dark text-white hover:from-lavender-600 hover:to-accent-dark/90'
                }`}
              >
                <Icon name={demoLoading ? 'hourglass_empty' : 'play_circle'} size={18} />
                {demoLoading ? t.settings.loadingDemo : t.settings.loadDemo}
              </button>
            </>
          )}
        </div>
      </Card>

      {/* App Mode */}
      <Card title={t.settings.appMode}>
        <div className="space-y-2">
          {[
            { mode: 'ai' as const, icon: 'smart_toy', label: t.settings.aiMode, desc: t.settings.aiModeDesc },
            { mode: 'notebook' as const, icon: 'note', label: t.settings.notebookMode, desc: t.settings.notebookModeDesc },
          ].map(opt => (
            <button
              key={opt.mode}
              onClick={async () => {
                const { update } = await import('@/lib/db').then(m => ({ update: m.saveSettings }));
                await update({ appMode: opt.mode });
              }}
              className={`w-full text-left rounded-lg p-3 border transition-colors ${
                settings?.appMode === opt.mode ? 'border-accent-dark bg-accent-warm/20' : 'border-border bg-bg-primary'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon name={opt.icon} size={24} className="text-lavender-500" />
                <div>
                  <div className="text-xs font-medium">{opt.label}</div>
                  <div className="text-[10px] text-text-secondary">{opt.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Theme */}
      <Card title={t.settings.appearance}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name={settings?.theme === 'dark' ? 'dark_mode' : 'light_mode'} size={20} className="text-lavender-500" />
            <div>
              <div className="text-xs font-medium">{t.settings.theme}</div>
              <div className="text-[10px] text-text-secondary">{settings?.theme === 'dark' ? t.settings.themeDark : t.settings.themeLight}</div>
            </div>
          </div>
          <button
            onClick={async () => {
              const newTheme: ThemeMode = settings?.theme === 'dark' ? 'light' : 'dark';
              document.documentElement.classList.toggle('dark', newTheme === 'dark');
              await updateSettings({ theme: newTheme });
            }}
            className={`w-11 h-6 rounded-full relative transition-colors ${
              settings?.theme === 'dark' ? 'bg-lavender-600' : 'bg-lavender-200'
            }`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${
              settings?.theme === 'dark' ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
      </Card>

      {/* AI Provider — only show in AI mode */}
      {settings?.appMode === 'ai' && <AIProviderSettings />}

      {/* Notifications */}
      <NotificationSettings />

      {/* Patient Profile */}
      {patient && (
        <Card title={t.settings.patientProfile}>
          <div className="space-y-2 text-sm">
            <ProfileRow label={t.settings.nickname} value={patient.displayName} />
            <ProfileRow label={t.settings.diagnosis} value={patient.diagnosis} />
            <ProfileRow label={t.settings.stage} value={patient.stage} />
            {patient.molecularSubtype && <ProfileRow label={t.settings.subtype} value={patient.molecularSubtype} />}
            <ProfileRow label={t.settings.chemoRegimen} value={patient.currentChemo || t.common.notProvided} />
            <ProfileRow label={t.settings.cycle} value={patient.chemoCycle || t.common.notProvided} />

            {patient.oncologyMeds.filter(m => m.active).length > 0 && (
              <div>
                <div className="text-xs text-text-secondary mt-2 mb-1">{t.settings.oncologyMeds}</div>
                {patient.oncologyMeds.filter(m => m.active).map((med, i) => (
                  <DrugRow key={i} drug={med} />
                ))}
              </div>
            )}

            {patient.psychiatricMeds.filter(m => m.active).length > 0 && (
              <div>
                <div className="text-xs text-text-secondary mt-2 mb-1">{t.settings.psychiatricMeds}</div>
                {patient.psychiatricMeds.filter(m => m.active).map((med, i) => (
                  <DrugRow key={i} drug={med} />
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Connected Devices */}
      <ConnectedDevices />

      {/* Historical Data Import */}
      <HistoricalImport />

      {/* Privacy */}
      {patient?.pii && (
        <Card title={t.settings.privacy}>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-lavender-500" style={{fontSize:16}}>lock</span>
              <span className="text-text-secondary">{t.settings.firstName}</span>
              <span>{patient.pii.firstName || `(${t.common.notProvided.toLowerCase()})`}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-lavender-500" style={{fontSize:16}}>lock</span>
              <span className="text-text-secondary">{t.settings.lastName}</span>
              <span>{patient.pii.lastName || `(${t.common.notProvided.toLowerCase()})`}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-lavender-500" style={{fontSize:16}}>lock</span>
              <span className="text-text-secondary">{t.settings.pesel}</span>
              <span>{patient.pii.pesel ? '***' + patient.pii.pesel.slice(-4) : `(${t.common.notProvided.toLowerCase()})`}</span>
            </div>
            <p className="text-[10px] text-text-secondary mt-2">
              {t.settings.privacyNote(patient.displayName)}
            </p>
          </div>
        </Card>
      )}

      {/* Data & Backup */}
      <Card title={lang === 'pl' ? 'Twoje dane i kopia zapasowa' : 'Your data & backup'}>
        <div className="space-y-3">
          {/* Info about local storage */}
          <div className="flex items-start gap-2.5">
            <Icon name="smartphone" size={18} className="text-accent-green shrink-0 mt-0.5" />
            <div className="text-[11px] text-text-secondary leading-relaxed">
              {lang === 'pl'
                ? 'Dane zapisane w przeglądarce tego telefonu. Nie są wysyłane na serwer. Czyszczenie danych przeglądarki = utrata danych.'
                : 'Data stored in this phone\'s browser. Not sent to any server. Clearing browser data = data loss.'}
            </div>
          </div>

          {/* Auto-backup to folder (Chrome/Android) */}
          {fsSupported && (
            <div className="bg-bg-primary rounded-xl border border-border p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <Icon name="folder_copy" size={18} className="text-accent-dark" />
                <span className="text-xs font-semibold text-text-primary">
                  {lang === 'pl' ? 'Auto-backup do folderu' : 'Auto-backup to folder'}
                </span>
              </div>

              {backupFolder ? (
                <>
                  <div className="flex items-center gap-2 bg-accent-green/10 rounded-lg px-3 py-2">
                    <Icon name="check_circle" size={16} className="text-accent-green shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-accent-green truncate">
                        {lang === 'pl' ? 'Folder:' : 'Folder:'} {backupFolder}
                      </div>
                      {backupInfo && (
                        <div className="text-[10px] text-text-secondary">
                          {lang === 'pl' ? 'Ostatni backup:' : 'Last backup:'} {backupInfo.date} ({backupInfo.size})
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setBackupStatus('saving');
                        const ok = await writeBackupToFolder();
                        setBackupStatus(ok ? 'saved' : 'error');
                        if (ok) {
                          const info = await getLatestBackupInfo();
                          setBackupInfo(info);
                        }
                        setTimeout(() => setBackupStatus('idle'), 3000);
                      }}
                      disabled={backupStatus === 'saving'}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors ${
                        backupStatus === 'saved'
                          ? 'bg-accent-green text-white'
                          : backupStatus === 'error'
                            ? 'bg-alert-critical text-white'
                            : 'bg-accent-dark text-white hover:bg-accent-dark/90'
                      }`}
                    >
                      <Icon name={backupStatus === 'saved' ? 'check' : backupStatus === 'error' ? 'error' : 'backup'} size={16} />
                      {backupStatus === 'saving' ? (lang === 'pl' ? 'Zapisuję...' : 'Saving...')
                        : backupStatus === 'saved' ? (lang === 'pl' ? 'Zapisano!' : 'Saved!')
                        : backupStatus === 'error' ? (lang === 'pl' ? 'Błąd' : 'Error')
                        : (lang === 'pl' ? 'Zapisz teraz' : 'Save now')}
                    </button>

                    <button
                      onClick={async () => {
                        if (!confirm(lang === 'pl'
                          ? 'Przywrócić dane z ostatniego backupu? Obecne dane zostaną zastąpione.'
                          : 'Restore from last backup? Current data will be replaced.')) return;
                        const ok = await restoreFromBackup();
                        if (ok) window.location.reload();
                        else alert(lang === 'pl' ? 'Nie znaleziono backupu w folderze.' : 'No backup found in folder.');
                      }}
                      className="flex items-center justify-center gap-1.5 rounded-lg py-2 px-3 text-xs font-medium border border-accent-dark text-accent-dark"
                    >
                      <Icon name="restore" size={16} />
                    </button>
                  </div>

                  <button
                    onClick={async () => {
                      await removeBackupFolder();
                      setBackupFolder(null);
                      setBackupInfo(null);
                    }}
                    className="w-full text-[10px] text-text-tertiary hover:text-text-secondary text-center py-1"
                  >
                    {lang === 'pl' ? 'Odłącz folder' : 'Disconnect folder'}
                  </button>
                </>
              ) : (
                <>
                  <div className="text-[11px] text-text-secondary leading-relaxed">
                    {lang === 'pl'
                      ? 'Wybierz folder na telefonie (np. w Dokumentach), gdzie aplikacja będzie zapisywać kopie zapasowe. Pliki będą bezpieczne nawet po czyszczeniu przeglądarki.'
                      : 'Choose a folder on your phone (e.g., in Documents) where the app will save backups. Files will be safe even after clearing browser data.'}
                  </div>
                  <button
                    onClick={async () => {
                      const name = await pickBackupFolder();
                      if (name) {
                        setBackupFolder(name);
                        // Immediately create first backup
                        await writeBackupToFolder();
                        const info = await getLatestBackupInfo();
                        setBackupInfo(info);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-accent-dark text-white rounded-lg py-2.5 text-xs font-medium"
                  >
                    <Icon name="create_new_folder" size={18} />
                    {lang === 'pl' ? 'Wybierz folder backupu' : 'Choose backup folder'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* iOS/Safari fallback info */}
          {!fsSupported && (
            <div className="bg-lavender-50 rounded-xl border border-lavender-200 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Icon name="ios_share" size={18} className="text-lavender-600" />
                <span className="text-xs font-semibold text-text-primary">
                  {lang === 'pl' ? 'Kopia zapasowa (iPhone/Safari)' : 'Backup (iPhone/Safari)'}
                </span>
              </div>
              <div className="text-[11px] text-text-secondary leading-relaxed">
                {lang === 'pl'
                  ? 'Twoja przeglądarka nie obsługuje auto-backupu do folderu. Użyj przycisku poniżej, aby pobrać kopię danych. Plik zostanie zapisany w Plikach → Pobrane.'
                  : 'Your browser doesn\'t support auto-backup to folder. Use the button below to download a data copy. The file will be saved to Files → Downloads.'}
              </div>
              <button
                onClick={() => downloadBackup()}
                className="w-full flex items-center justify-center gap-2 bg-accent-dark text-white rounded-lg py-2.5 text-xs font-medium"
              >
                <Icon name="download" size={18} />
                {lang === 'pl' ? 'Pobierz kopię zapasową' : 'Download backup'}
              </button>
            </div>
          )}

          {/* Manual export/import/reset */}
          <div className="pt-1 space-y-2">
            <div className="text-[10px] text-text-tertiary font-medium uppercase tracking-wider px-1">
              {lang === 'pl' ? 'Ręczne zarządzanie' : 'Manual management'}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="flex-1 border border-border text-text-secondary rounded-lg py-2 text-xs flex items-center justify-center gap-1"
              >
                <Icon name="upload" size={14} />
                {lang === 'pl' ? 'Eksport JSON' : 'Export JSON'}
              </button>
              <button
                onClick={handleImport}
                className="flex-1 border border-border text-text-secondary rounded-lg py-2 text-xs flex items-center justify-center gap-1"
              >
                <Icon name="download" size={14} />
                {lang === 'pl' ? 'Import JSON' : 'Import JSON'}
              </button>
            </div>
            <button
              onClick={handleReset}
              className="w-full border border-alert-critical/30 text-alert-critical rounded-lg py-2 text-[11px]"
            >
              {t.settings.resetData}
            </button>
          </div>
        </div>
      </Card>

      {/* Feedback & Bug Reports */}
      <FeedbackSection />

      {/* PWA install hint */}
      <Card title={t.settings.pwaInstall}>
        <div className="text-xs text-text-secondary space-y-1">
          <p><strong>{t.settings.pwaIphone}</strong> {t.settings.pwaIphoneDesc}</p>
          <p><strong>{t.settings.pwaAndroid}</strong> {t.settings.pwaAndroidDesc}</p>
        </div>
      </Card>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-border">
      <span className="text-text-secondary text-xs">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}

function DrugRow({ drug }: { drug: DrugEntry }) {
  return (
    <div className="text-xs py-0.5 pl-2 border-l-2 border-accent-green">
      {drug.name} {drug.dose} — {drug.frequency}
    </div>
  );
}

// ==================== FEEDBACK SECTION ====================

const GITHUB_REPO = 'Domingo007/AlpacaLive';
const APP_VERSION = '1.0.0';

type FeedbackType = 'bug' | 'feature' | 'improvement' | 'medical';

function FeedbackSection() {
  const [showForm, setShowForm] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sent, setSent] = useState(false);
  const { lang } = useI18n();

  const labels = lang === 'pl' ? {
    cardTitle: 'Zgłoszenia i pomysły',
    subtitle: 'Pomóż nam ulepszać aplikację. Zgłoś błąd, zaproponuj nową funkcję lub podziel się opinią.',
    openForm: 'Napisz do nas',
    bug: 'Błąd',
    bugDesc: 'Coś nie działa poprawnie',
    feature: 'Nowa funkcja',
    featureDesc: 'Czego brakuje w aplikacji',
    improvement: 'Ulepszenie',
    improvementDesc: 'Co można poprawić',
    medical: 'Dane medyczne',
    medicalDesc: 'Brakujący lek, norma, choroba',
    titleLabel: 'Krótki opis',
    titlePlaceholder: 'np. Brak formularza dla terapii protonowej',
    descLabel: 'Szczegóły (opcjonalne)',
    descPlaceholder: 'Opisz problem lub pomysł szczegółowo...',
    sendGithub: 'Wyślij przez GitHub',
    sendEmail: 'Wyślij mailem',
    sentMsg: 'Dziękujemy za zgłoszenie!',
    githubNote: 'Otworzy się GitHub — możesz tam zobaczyć odpowiedzi na swoje zgłoszenie.',
    viewIssues: 'Zobacz zgłoszenia community',
  } : {
    cardTitle: 'Feedback & Ideas',
    subtitle: 'Help us improve the app. Report a bug, suggest a feature, or share your feedback.',
    openForm: 'Write to us',
    bug: 'Bug',
    bugDesc: 'Something isn\'t working',
    feature: 'New feature',
    featureDesc: 'What\'s missing in the app',
    improvement: 'Improvement',
    improvementDesc: 'What could be better',
    medical: 'Medical data',
    medicalDesc: 'Missing drug, norm, disease',
    titleLabel: 'Short description',
    titlePlaceholder: 'e.g., Missing form for proton therapy',
    descLabel: 'Details (optional)',
    descPlaceholder: 'Describe the problem or idea in detail...',
    sendGithub: 'Submit via GitHub',
    sendEmail: 'Send by email',
    sentMsg: 'Thank you for your feedback!',
    githubNote: 'GitHub will open — you can see responses to your submission there.',
    viewIssues: 'View community submissions',
  };

  const typeOptions: { id: FeedbackType; icon: string; label: string; desc: string; ghLabel: string; template: string }[] = [
    { id: 'bug', icon: 'bug_report', label: labels.bug, desc: labels.bugDesc, ghLabel: 'bug', template: 'bug_report.md' },
    { id: 'feature', icon: 'lightbulb', label: labels.feature, desc: labels.featureDesc, ghLabel: 'enhancement', template: 'feature_request.md' },
    { id: 'improvement', icon: 'tune', label: labels.improvement, desc: labels.improvementDesc, ghLabel: 'improvement', template: 'feature_request.md' },
    { id: 'medical', icon: 'medical_information', label: labels.medical, desc: labels.medicalDesc, ghLabel: 'medical-knowledge', template: 'medical_data.md' },
  ];

  function buildTechnicalMetadata(): string {
    const provider = (() => {
      try {
        return localStorage.getItem('alpacalive-ai-provider') || 'unknown';
      } catch {
        return 'unknown';
      }
    })();
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.split(') ')[0] + ')' : 'unknown';
    return [
      `**App version:** ${APP_VERSION}`,
      `**AI Provider:** ${provider}`,
      `**Section:** Settings → Feedback`,
      `**Language:** ${lang.toUpperCase()}`,
      `**Timestamp:** ${new Date().toISOString()}`,
      `**User-Agent:** ${ua}`,
    ].join('\n');
  }

  function buildGitHubUrl(): string {
    const typeInfo = typeOptions.find(t => t.id === feedbackType);
    const ghLabel = typeInfo?.ghLabel || 'feedback';
    const body = [
      `## ${typeInfo?.label || feedbackType}`,
      '',
      '**User description:**',
      '',
      description || '_(no details provided)_',
      '',
      '---',
      '',
      buildTechnicalMetadata(),
    ].join('\n');

    const params = new URLSearchParams({
      template: typeInfo?.template || 'bug_report.md',
      title: `[${ghLabel}] ${title}`,
      body,
      labels: ghLabel,
    });

    return `https://github.com/${GITHUB_REPO}/issues/new?${params.toString()}`;
  }

  function buildMailtoUrl(): string {
    const typeInfo = typeOptions.find(t => t.id === feedbackType);
    const subject = `[AlpacaLive ${typeInfo?.label}] ${title}`;
    const body = `${description}\n\n---\nTyp: ${typeInfo?.label}\nJęzyk: ${lang.toUpperCase()}`;
    return `mailto:feedback@alpacalive.app?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  if (sent) {
    return (
      <Card title={labels.cardTitle}>
        <div className="text-center py-4 space-y-2">
          <Icon name="check_circle" size={32} className="mx-auto text-accent-green" />
          <div className="text-sm font-medium text-accent-green">{labels.sentMsg}</div>
        </div>
      </Card>
    );
  }

  return (
    <Card title={labels.cardTitle}>
      <div className="space-y-3">
        {!showForm ? (
          <>
            <p className="text-[11px] text-text-secondary leading-relaxed">{labels.subtitle}</p>
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 bg-accent-dark text-white rounded-lg py-2.5 text-xs font-medium"
            >
              <Icon name="rate_review" size={18} />
              {labels.openForm}
            </button>
            <a
              href={`https://github.com/${GITHUB_REPO}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-1.5 text-[11px] text-accent-dark hover:underline"
            >
              <Icon name="open_in_new" size={14} />
              {labels.viewIssues}
            </a>
          </>
        ) : (
          <>
            {/* Type selector */}
            <div className="grid grid-cols-2 gap-1.5">
              {typeOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setFeedbackType(opt.id)}
                  className={`flex items-center gap-1.5 p-2 rounded-lg text-left transition-colors ${
                    feedbackType === opt.id
                      ? 'bg-accent-dark text-white'
                      : 'bg-bg-primary border border-border'
                  }`}
                >
                  <Icon name={opt.icon} size={16} />
                  <div>
                    <div className="text-[11px] font-medium">{opt.label}</div>
                    <div className={`text-[9px] ${feedbackType === opt.id ? 'text-white/70' : 'text-text-tertiary'}`}>{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Title */}
            <div>
              <label className="text-xs text-text-secondary block mb-1">{labels.titleLabel}</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={labels.titlePlaceholder}
                className="w-full rounded-lg border border-border px-3 py-2 text-xs bg-bg-primary"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-text-secondary block mb-1">{labels.descLabel}</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={labels.descPlaceholder}
                rows={3}
                className="w-full rounded-lg border border-border px-3 py-2 text-xs bg-bg-primary resize-y"
              />
            </div>

            {/* Submit buttons */}
            <div className="space-y-2">
              <a
                href={buildGitHubUrl()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => { setSent(true); setTimeout(() => { setSent(false); setShowForm(false); setTitle(''); setDescription(''); }, 5000); }}
                className={`w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-medium transition-colors ${
                  !title.trim()
                    ? 'bg-lavender-200 text-text-tertiary pointer-events-none'
                    : 'bg-accent-dark text-white hover:bg-accent-dark/90'
                }`}
              >
                <Icon name="open_in_new" size={16} />
                {labels.sendGithub}
              </a>

              <a
                href={buildMailtoUrl()}
                onClick={() => { setSent(true); setTimeout(() => { setSent(false); setShowForm(false); setTitle(''); setDescription(''); }, 5000); }}
                className={`w-full flex items-center justify-center gap-2 rounded-lg py-2 text-xs border transition-colors ${
                  !title.trim()
                    ? 'border-border text-text-tertiary pointer-events-none'
                    : 'border-accent-dark text-accent-dark'
                }`}
              >
                <Icon name="mail" size={16} />
                {labels.sendEmail}
              </a>
            </div>

            <p className="text-[10px] text-text-tertiary text-center">{labels.githubNote}</p>

            <button
              onClick={() => { setShowForm(false); setTitle(''); setDescription(''); }}
              className="w-full text-[11px] text-text-tertiary hover:text-text-secondary text-center py-1"
            >
              {lang === 'pl' ? 'Anuluj' : 'Cancel'}
            </button>
          </>
        )}
      </div>
    </Card>
  );
}
