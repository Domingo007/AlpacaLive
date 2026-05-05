import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { Card } from '@/components/shared/Card';
import { Icon } from '@/components/shared/Icon';
import { UnknownDrugBubble } from '@/components/shared/UnknownDrugBubble';
import { useI18n } from '@/lib/i18n';
import { detectUnknownDrugs } from '@/lib/medical-data/drug-resolver';
import { buildUnknownDrugIssueUrl } from '@/lib/medical-data/unknown-drug-feedback';

const IRAE_TYPES = [
  { value: 'skin', icon: 'dermatology' },
  { value: 'gi', icon: 'gastroenterology' },
  { value: 'hepatic', icon: 'hepatology' },
  { value: 'endocrine', icon: 'endocrinology' },
  { value: 'pulmonary', icon: 'pulmonology' },
  { value: 'renal', icon: 'nephrology' },
  { value: 'neurologic', icon: 'neurology' },
  { value: 'cardiac', icon: 'cardiology' },
  { value: 'other', icon: 'more_horiz' },
];

const IRAE_LABELS: Record<string, Record<string, string>> = {
  skin: { pl: 'Skóra', en: 'Skin' },
  gi: { pl: 'Jelita', en: 'GI' },
  hepatic: { pl: 'Wątroba', en: 'Liver' },
  endocrine: { pl: 'Endokrynne', en: 'Endocrine' },
  pulmonary: { pl: 'Płuca', en: 'Lungs' },
  renal: { pl: 'Nerki', en: 'Renal' },
  neurologic: { pl: 'Neurolog.', en: 'Neuro' },
  cardiac: { pl: 'Serce', en: 'Cardiac' },
  other: { pl: 'Inne', en: 'Other' },
};

export function ImmunotherapyEntryForm() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [drug, setDrug] = useState('');
  const [infusionNumber, setInfusionNumber] = useState('1');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const { t, lang } = useI18n();

  // irAE tracking
  const [showIrAE, setShowIrAE] = useState(false);
  const [iraeType, setIraeType] = useState('skin');
  const [iraeGrade, setIraeGrade] = useState(1);
  const [iraeDescription, setIraeDescription] = useState('');
  const [iraeList, setIraeList] = useState<{ type: string; grade: number; description: string }[]>([]);
  const [pendingUnknowns, setPendingUnknowns] = useState<string[] | null>(null);

  function addIrAE() {
    if (!iraeDescription.trim()) return;
    setIraeList(prev => [...prev, { type: iraeType, grade: iraeGrade, description: iraeDescription }]);
    setIraeDescription('');
    setIraeGrade(1);
  }

  async function persist() {
    await db.treatmentSessions.put({
      id: uuidv4(),
      date,
      treatmentType: 'immunotherapy',
      status: 'completed',
      details: {
        drug,
        infusionNumber: parseInt(infusionNumber) || 1,
        irAEs: iraeList,
      },
      notes: notes || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setInfusionNumber(String((parseInt(infusionNumber) || 1) + 1));
    setNotes('');
    setIraeList([]);
  }

  async function handleSave() {
    if (!date) return;
    const unknown = detectUnknownDrugs(drug);
    if (unknown.length > 0) {
      setPendingUnknowns(unknown);
      return;
    }
    await persist();
  }

  function handleReport(drugList: string[]) {
    const url = buildUnknownDrugIssueUrl(drugList, { language: lang, context: 'form', formType: 'immunotherapy' });
    window.open(url, '_blank', 'noopener');
    setPendingUnknowns(null);
  }

  async function handleContinue() {
    setPendingUnknowns(null);
    await persist();
  }

  const labels = lang === 'pl' ? {
    title: 'Infuzja immunoterapii',
    drug: 'Lek',
    drugPlaceholder: 'np. Pembrolizumab',
    infusionNumber: 'Numer infuzji',
    iraeSection: 'Immunologiczne zdarzenia niepożądane (irAE)',
    iraeAdd: 'Dodaj irAE',
    iraeType: 'Narząd',
    iraeGrade: 'Stopień',
    iraeDescription: 'Opis objawów',
    iraeDescPlaceholder: 'np. wysypka na klatce piersiowej',
    addIrAE: 'Dodaj',
    noIrAE: 'Brak irAE w tym cyklu',
    save: 'Zapisz infuzję',
    savedMsg: 'Zapisano!',
    preLabsNote: 'Pamiętaj o kontroli TSH, ALT/AST przed infuzją',
  } : {
    title: 'Immunotherapy infusion',
    drug: 'Drug',
    drugPlaceholder: 'e.g., Pembrolizumab',
    infusionNumber: 'Infusion number',
    iraeSection: 'Immune-related adverse events (irAE)',
    iraeAdd: 'Add irAE',
    iraeType: 'Organ system',
    iraeGrade: 'Grade',
    iraeDescription: 'Symptom description',
    iraeDescPlaceholder: 'e.g., rash on chest',
    addIrAE: 'Add',
    noIrAE: 'No irAE in this cycle',
    save: 'Save infusion',
    savedMsg: 'Saved!',
    preLabsNote: 'Remember to check TSH, ALT/AST before infusion',
  };

  return (
    <Card title={labels.title}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-text-secondary block mb-1">{t.common.date}</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-xs bg-bg-primary" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-text-secondary block mb-1">{labels.drug}</label>
            <input value={drug} onChange={e => setDrug(e.target.value)}
              placeholder={labels.drugPlaceholder}
              className="w-full rounded-lg border border-border px-3 py-2 text-xs bg-bg-primary" />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">{labels.infusionNumber}</label>
            <input type="number" value={infusionNumber} onChange={e => setInfusionNumber(e.target.value)}
              min="1" className="w-full rounded-lg border border-border px-3 py-2 text-xs bg-bg-primary" />
          </div>
        </div>

        <div className="text-[10px] text-accent-dark bg-accent-warm/30 rounded-lg px-3 py-1.5 flex items-center gap-1">
          <Icon name="info" size={14} />
          {labels.preLabsNote}
        </div>

        {/* irAE Section */}
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowIrAE(!showIrAE)}
            className="w-full flex items-center justify-between px-3 py-2 bg-bg-primary text-xs font-medium"
          >
            <span className="flex items-center gap-1">
              <Icon name="shield" size={16} className="text-alert-warning" />
              {labels.iraeSection}
            </span>
            <Icon name={showIrAE ? 'expand_less' : 'expand_more'} size={18} />
          </button>

          {showIrAE && (
            <div className="p-3 space-y-2 bg-bg-card">
              {iraeList.length > 0 && (
                <div className="space-y-1">
                  {iraeList.map((irae, i) => (
                    <div key={i} className="flex items-center justify-between bg-alert-warning/10 rounded px-2 py-1 text-[11px]">
                      <span>
                        <strong>{IRAE_LABELS[irae.type]?.[lang] || irae.type}</strong> G{irae.grade}: {irae.description}
                      </span>
                      <button onClick={() => setIraeList(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-alert-critical">
                        <Icon name="close" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-1">
                {IRAE_TYPES.map(type => (
                  <button key={type.value}
                    onClick={() => setIraeType(type.value)}
                    className={`flex items-center gap-0.5 px-2 py-1 rounded text-[10px] ${
                      iraeType === type.value ? 'bg-accent-dark text-white' : 'bg-bg-primary border border-border'
                    }`}
                  >
                    <Icon name={type.icon} size={12} />
                    {IRAE_LABELS[type.value]?.[lang] || type.value}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[10px] text-text-secondary shrink-0">{labels.iraeGrade}:</label>
                {[1, 2, 3, 4].map(g => (
                  <button key={g} onClick={() => setIraeGrade(g)}
                    className={`w-7 h-7 rounded-full text-[11px] font-medium ${
                      iraeGrade === g
                        ? g <= 2 ? 'bg-alert-warning text-white' : 'bg-alert-critical text-white'
                        : 'bg-bg-primary border border-border'
                    }`}
                  >{g}</button>
                ))}
              </div>

              <div className="flex gap-2">
                <input value={iraeDescription} onChange={e => setIraeDescription(e.target.value)}
                  placeholder={labels.iraeDescPlaceholder}
                  className="flex-1 rounded border border-border px-2 py-1.5 text-xs bg-bg-primary" />
                <button onClick={addIrAE} disabled={!iraeDescription.trim()}
                  className="px-3 py-1.5 bg-accent-dark text-white rounded text-xs disabled:opacity-40">
                  {labels.addIrAE}
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-text-secondary block mb-1">{t.common.notes}</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            rows={2} className="w-full rounded-lg border border-border px-3 py-2 text-xs bg-bg-primary resize-y" />
        </div>

        <button onClick={handleSave} disabled={!date}
          className="w-full bg-accent-dark text-accent-warm rounded-xl py-3 text-sm font-medium disabled:opacity-40">
          {saved ? labels.savedMsg : labels.save}
        </button>
      </div>
      {pendingUnknowns && (
        <UnknownDrugBubble
          context="form"
          unknownDrugs={pendingUnknowns}
          onReport={handleReport}
          onDismiss={handleContinue}
          onCancel={() => setPendingUnknowns(null)}
          onRemove={removed => setPendingUnknowns(prev => prev ? prev.filter(d => d !== removed) : null)}
        />
      )}
    </Card>
  );
}
