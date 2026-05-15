import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { pl } from './translations/pl';
import { en } from './translations/en';
import { de } from './translations/de';

export type Lang = 'pl' | 'en' | 'de';
export type Translations = typeof pl;

const STORAGE_KEY = 'alpacalive-lang';

const translations: Record<Lang, Translations> = { pl, en, de };

interface I18nContextValue {
  lang: Lang;
  t: Translations;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'pl',
  t: pl,
  setLang: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored === 'en' || stored === 'pl' || stored === 'de') ? (stored as Lang) : 'en';
  });

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem(STORAGE_KEY, newLang);
    document.documentElement.lang = newLang;
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, t: translations[lang], setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
