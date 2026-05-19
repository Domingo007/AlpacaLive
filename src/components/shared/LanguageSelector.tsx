import { useState, useRef, useEffect } from 'react';
import { Icon } from './Icon';
import { useI18n, type Lang } from '@/lib/i18n';
import { saveSettings } from '@/lib/db';

const LANGUAGES: { code: Lang; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  // Ready to extend:
  // { code: 'uk', label: 'Українська', flag: '🇺🇦' },
  // { code: 'fr', label: 'Français', flag: '🇫🇷' },
  // { code: 'es', label: 'Español', flag: '🇪🇸' },
  // { code: 'cs', label: 'Čeština', flag: '🇨🇿' },
  // { code: 'it', label: 'Italiano', flag: '🇮🇹' },
];

interface LanguageSelectorProps {
  /** Save to DB settings on change (default true). Set false for onboarding. */
  persist?: boolean;
  /** Compact mode — smaller for navbar/onboarding */
  compact?: boolean;
}

export function LanguageSelector({ persist = true, compact = false }: LanguageSelectorProps) {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  async function handleSelect(code: Lang) {
    setLang(code);
    setOpen(false);
    if (persist) {
      await saveSettings({ language: code });
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg border border-border transition-colors hover:bg-bg-elevated ${
          compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
        } ${open ? 'bg-bg-elevated border-accent-dark/30' : 'bg-bg-primary'}`}
      >
        <Icon name="language" size={compact ? 16 : 18} className="text-lavender-500" />
        <span className="font-medium text-text-primary">{current.code.toUpperCase()}</span>
        <Icon name={open ? 'expand_less' : 'expand_more'} size={compact ? 14 : 16} className="text-text-tertiary" />
      </button>

      {open && (
        <div className={`absolute z-50 mt-1 bg-bg-card border border-border rounded-xl shadow-lg overflow-hidden ${
          compact ? 'right-0 min-w-[140px]' : 'left-0 min-w-[180px]'
        }`}>
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => handleSelect(l.code)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                lang === l.code
                  ? 'bg-accent-warm/40 text-accent-dark font-medium'
                  : 'hover:bg-bg-elevated text-text-primary'
              }`}
            >
              <span className="text-base">{l.flag}</span>
              <span className={compact ? 'text-xs' : 'text-sm'}>{l.label}</span>
              {lang === l.code && (
                <Icon name="check" size={16} className="text-accent-dark ml-auto" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
