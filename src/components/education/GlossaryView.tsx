import { useState, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { localized } from '@/lib/medical-data/content-utils';
import type { EducationPackage } from '@/lib/medical-data/knowledge-types';

interface GlossaryViewProps {
  education: EducationPackage;
}

export function GlossaryView({ education }: GlossaryViewProps) {
  const [search, setSearch] = useState('');
  const { lang } = useI18n();

  const terms = useMemo(() => {
    const all = education.glossary.terms;
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter(t =>
      localized(t.term, lang).toLowerCase().includes(q) ||
      localized(t.definition, lang).toLowerCase().includes(q),
    );
  }, [education.glossary.terms, search, lang]);

  const categories = [...new Set(terms.map(t => t.category))];

  return (
    <div className="space-y-3">
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={lang === 'pl' ? 'Szukaj terminu...' : lang === 'de' ? 'Begriff suchen...' : 'Search term...'}
        className="w-full rounded-lg border border-border px-3 py-2 text-xs bg-bg-card"
      />

      {categories.map(cat => {
        const catTerms = terms.filter(t => t.category === cat);
        if (catTerms.length === 0) return null;
        return (
          <div key={cat}>
            <div className="text-[10px] font-medium text-text-secondary uppercase tracking-wider mb-1 px-1">
              {cat}
            </div>
            <div className="space-y-1">
              {catTerms.map(term => (
                <div key={term.id} className="bg-bg-card rounded-lg border border-border p-3">
                  <div className="text-xs font-semibold text-accent-dark">{localized(term.term, lang)}</div>
                  <div className="text-[11px] text-text-primary mt-1 leading-relaxed">{localized(term.definition, lang)}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {terms.length === 0 && (
        <div className="text-center text-sm text-text-secondary py-8">
          {lang === 'pl' ? 'Brak wyników' : lang === 'de' ? 'Keine Ergebnisse' : 'No results'}
        </div>
      )}
    </div>
  );
}
