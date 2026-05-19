import { useState } from 'react';
import { GlossaryView } from './GlossaryView';
import { PhaseGuidesView } from './PhaseGuidesView';
import { WhenToCallView } from './WhenToCallView';
import { FaqView } from './FaqView';
import { SideEffectTipsView } from './SideEffectTipsView';
import { Icon } from '@/components/shared/Icon';
import { useI18n } from '@/lib/i18n';
import { usePatient } from '@/hooks/useDatabase';
import { getDiseaseKnowledge } from '@/lib/medical-data/knowledge-registry';
import { localized } from '@/lib/medical-data/content-utils';

type EducationSection = 'overview' | 'glossary' | 'phases' | 'when_to_call' | 'faq' | 'side_effects';

interface EducationViewProps {
  onClose: () => void;
}

export function EducationView({ onClose }: EducationViewProps) {
  const [section, setSection] = useState<EducationSection>('overview');
  const { t, lang } = useI18n();
  const { patient } = usePatient();

  const knowledge = patient?.diseaseProfileId ? getDiseaseKnowledge(patient.diseaseProfileId) : null;
  const diseaseName = knowledge ? localized(knowledge.profile.name, lang) : null;

  const labels = t.education;

  const sections: { id: EducationSection; icon: string; label: string; desc: string }[] = [
    { id: 'glossary', icon: 'dictionary', label: labels.glossary, desc: labels.glossaryDesc },
    { id: 'phases', icon: 'timeline', label: labels.phases, desc: labels.phasesDesc },
    { id: 'when_to_call', icon: 'emergency', label: labels.whenToCall, desc: labels.whenToCallDesc },
    { id: 'side_effects', icon: 'healing', label: labels.sideEffects, desc: labels.sideEffectsDesc },
    { id: 'faq', icon: 'help', label: labels.faq, desc: labels.faqDesc },
  ];

  if (section !== 'overview') {
    return (
      <div className="h-full flex flex-col bg-bg-primary">
        <div className="flex items-center gap-2 px-3 py-3 border-b border-border shrink-0">
          <button onClick={() => setSection('overview')} className="p-1">
            <Icon name="arrow_back" size={22} className="text-accent-dark" />
          </button>
          <h2 className="text-sm font-semibold text-accent-dark">
            {sections.find(s => s.id === section)?.label || labels.title}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {section === 'glossary' && knowledge && <GlossaryView education={knowledge.education} />}
          {section === 'phases' && knowledge && <PhaseGuidesView education={knowledge.education} />}
          {section === 'when_to_call' && knowledge && <WhenToCallView education={knowledge.education} />}
          {section === 'faq' && knowledge && <FaqView education={knowledge.education} />}
          {section === 'side_effects' && knowledge && <SideEffectTipsView education={knowledge.education} />}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      <div className="flex items-center justify-between px-3 py-3 border-b border-border shrink-0">
        <h2 className="font-display text-lg font-semibold text-accent-dark">{labels.title}</h2>
        <button onClick={onClose} className="p-1">
          <Icon name="close" size={22} className="text-text-secondary" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {diseaseName && (
          <div className="bg-accent-warm/30 rounded-xl px-4 py-3 text-center">
            <div className="text-xs text-text-secondary">{t.education.diseaseProfile}</div>
            <div className="text-sm font-semibold text-accent-dark">{diseaseName}</div>
          </div>
        )}

        {!knowledge ? (
          <div className="text-center text-sm text-text-secondary py-8">
            <Icon name="info" size={32} className="mx-auto mb-2 text-lavender-300" />
            {labels.noDisease}
          </div>
        ) : (
          <div className="space-y-2">
            {sections.map(sec => (
              <button
                key={sec.id}
                onClick={() => setSection(sec.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-bg-card border border-border hover:border-accent-dark/30 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-accent-warm flex items-center justify-center shrink-0">
                  <Icon name={sec.icon} size={22} className="text-accent-dark" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-text-primary">{sec.label}</div>
                  <div className="text-[10px] text-text-secondary">{sec.desc}</div>
                </div>
                <Icon name="chevron_right" size={18} className="text-text-tertiary shrink-0" />
              </button>
            ))}
          </div>
        )}

        <p className="text-[10px] text-text-secondary text-center px-4 pt-2">
          {labels.disclaimer}
        </p>
      </div>
    </div>
  );
}
