import { useMemo } from 'react';
import { DailyLogForm } from './DailyLogForm';
import { BloodEntryForm } from './BloodEntryForm';
import { ChemoEntryForm } from './ChemoEntryForm';
import { RadiotherapyEntryForm } from './RadiotherapyEntryForm';
import { ImmunotherapyEntryForm } from './ImmunotherapyEntryForm';
import { HormonalTherapyEntryForm } from './HormonalTherapyEntryForm';
import { SupplementTracker } from './SupplementTracker';
import { ImagingEntryForm } from './ImagingEntryForm';
import { DisclaimerBanner } from '@/components/shared/DisclaimerBanner';
import { Icon } from '@/components/shared/Icon';
import { useI18n } from '@/lib/i18n';
import { usePatient } from '@/hooks/useDatabase';
import type { NotebookTab } from '@/types';

interface NotebookViewProps {
  activeTab: NotebookTab;
  onTabChange: (tab: NotebookTab) => void;
}

export function NotebookView({ activeTab: tab, onTabChange: setTab }: NotebookViewProps) {
  const { t, lang } = useI18n();
  const { patient } = usePatient();

  // Build tabs dynamically based on patient's active treatments
  const tabs = useMemo(() => {
    const activeTreatments = new Set<string>();
    if (patient?.currentChemo) activeTreatments.add('chemotherapy');
    for (const tr of patient?.treatments || []) {
      if (tr.status === 'active') activeTreatments.add(tr.type);
    }

    const result: { id: NotebookTab; icon: string; label: string }[] = [
      { id: 'daily', icon: 'edit_note', label: t.notebook.journal },
      { id: 'blood', icon: 'water_drop', label: t.notebook.blood },
    ];

    // Conditional treatment tabs
    if (activeTreatments.has('chemotherapy')) {
      result.push({ id: 'chemo', icon: 'vaccines', label: t.notebook.chemo });
    }
    if (activeTreatments.has('radiotherapy')) {
      result.push({ id: 'radiotherapy', icon: 'radiology', label: lang === 'pl' ? 'RT' : lang === 'de' ? 'RT' : 'RT' });
    }
    if (activeTreatments.has('immunotherapy')) {
      result.push({ id: 'immunotherapy', icon: 'shield', label: lang === 'pl' ? 'Immuno' : lang === 'de' ? 'Immun' : 'Immuno' });
    }
    if (activeTreatments.has('hormonal_therapy')) {
      result.push({ id: 'hormonal', icon: 'medication', label: lang === 'pl' ? 'Hormono' : lang === 'de' ? 'Hormon' : 'Hormonal' });
    }

    // Always show at end
    result.push({ id: 'supplements', icon: 'medication', label: t.notebook.supplements });
    result.push({ id: 'imaging', icon: 'imagesmode', label: t.notebook.imaging });

    return result;
  }, [patient, t, lang]);

  // If active tab is not in available tabs, fall back to 'daily'
  const effectiveTab = tabs.some(tb => tb.id === tab) ? tab : 'daily';

  return (
    <div className="h-full flex flex-col">
      <div className="flex gap-1 px-3 pt-3 pb-1 overflow-x-auto shrink-0">
        {tabs.map(tb => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs whitespace-nowrap shrink-0 ${
              effectiveTab === tb.id ? 'bg-accent-dark text-accent-warm' : 'bg-bg-card border border-border text-text-secondary'
            }`}
          >
            <Icon name={tb.icon} size={16} />
            <span>{tb.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {effectiveTab === 'daily' && <DailyLogForm />}
        {effectiveTab === 'blood' && <BloodEntryForm />}
        {effectiveTab === 'chemo' && <ChemoEntryForm />}
        {effectiveTab === 'radiotherapy' && <RadiotherapyEntryForm />}
        {effectiveTab === 'immunotherapy' && <ImmunotherapyEntryForm />}
        {effectiveTab === 'hormonal' && <HormonalTherapyEntryForm />}
        {effectiveTab === 'supplements' && <SupplementTracker />}
        {effectiveTab === 'imaging' && <ImagingEntryForm />}
      </div>

      <div className="px-3 py-2 bg-accent-warm/30 border-t border-accent-warm/50 text-center shrink-0">
        <p className="text-[10px] text-text-secondary">
          {t.notebook.aiPromo}
          <span className="text-accent-dark font-medium ml-1 cursor-pointer">{t.notebook.enableInSettings}</span>
        </p>
      </div>

      <DisclaimerBanner variant="chat" />
    </div>
  );
}
