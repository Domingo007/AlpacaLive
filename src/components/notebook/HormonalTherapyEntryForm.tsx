import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { Card } from '@/components/shared/Card';
import { Icon } from '@/components/shared/Icon';
import { UnknownDrugBubble } from '@/components/shared/UnknownDrugBubble';
import { useI18n } from '@/lib/i18n';
import { detectUnknownDrugs } from '@/lib/medical-data/drug-resolver';
import { buildUnknownDrugIssueUrl } from '@/lib/medical-data/unknown-drug-feedback';

export function HormonalTherapyEntryForm() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [drug, setDrug] = useState('');
  const [taken, setTaken] = useState(true);
  const [jointPain, setJointPain] = useState(0);
  const [hotFlashes, setHotFlashes] = useState(0);
  const [mood, setMood] = useState(5);
  const [fatigue, setFatigue] = useState(3);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [pendingUnknowns, setPendingUnknowns] = useState<string[] | null>(null);
  const { t, lang } = useI18n();

  async function persist() {
    await db.treatmentSessions.put({
      id: uuidv4(),
      date,
      treatmentType: 'hormonal_therapy',
      status: taken ? 'completed' : 'cancelled',
      details: {
        drug,
        taken,
        jointPain,
        hotFlashes,
        mood,
        fatigue,
      },
      notes: notes || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setNotes('');
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
    const url = buildUnknownDrugIssueUrl(drugList, { language: lang, context: 'form', formType: 'hormonal' });
    window.open(url, '_blank', 'noopener');
    setPendingUnknowns(null);
  }

  async function handleContinue() {
    setPendingUnknowns(null);
    await persist();
  }

  const labels = lang === 'pl' ? {
    title: 'Hormonoterapia — dzienny wpis',
    drug: 'Lek',
    drugPlaceholder: 'np. Tamoxifen 20mg',
    taken: 'Wzięte dziś?',
    takenYes: 'Tak, wzięte',
    takenNo: 'Nie wzięte',
    jointPain: 'Bóle stawów',
    hotFlashes: 'Uderzenia gorąca',
    mood: 'Nastrój',
    fatigue: 'Zmęczenie',
    save: 'Zapisz dzień',
    savedMsg: 'Zapisano!',
    adherenceNote: 'Codzienne logowanie pomaga śledzić adherence i efekty uboczne',
  } : {
    title: 'Hormonal therapy — daily entry',
    drug: 'Drug',
    drugPlaceholder: 'e.g., Tamoxifen 20mg',
    taken: 'Taken today?',
    takenYes: 'Yes, taken',
    takenNo: 'Not taken',
    jointPain: 'Joint pain',
    hotFlashes: 'Hot flashes',
    mood: 'Mood',
    fatigue: 'Fatigue',
    save: 'Save day',
    savedMsg: 'Saved!',
    adherenceNote: 'Daily logging helps track adherence and side effects',
  };

  return (
    <Card title={labels.title}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-text-secondary block mb-1">{t.common.date}</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-xs bg-bg-primary" />
        </div>

        <div>
          <label className="text-xs text-text-secondary block mb-1">{labels.drug}</label>
          <input value={drug} onChange={e => setDrug(e.target.value)}
            placeholder={labels.drugPlaceholder}
            className="w-full rounded-lg border border-border px-3 py-2 text-xs bg-bg-primary" />
        </div>

        {/* Main toggle — taken today? */}
        <div>
          <label className="text-xs text-text-secondary block mb-1">{labels.taken}</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTaken(true)}
              className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-colors ${
                taken
                  ? 'bg-accent-green text-white'
                  : 'bg-bg-primary border border-border text-text-secondary'
              }`}
            >
              <Icon name="check_circle" size={20} />
              {labels.takenYes}
            </button>
            <button
              onClick={() => setTaken(false)}
              className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-colors ${
                !taken
                  ? 'bg-alert-critical text-white'
                  : 'bg-bg-primary border border-border text-text-secondary'
              }`}
            >
              <Icon name="cancel" size={20} />
              {labels.takenNo}
            </button>
          </div>
        </div>

        {/* Side effects sliders */}
        <div className="space-y-2">
          <div>
            <label className="text-xs text-text-secondary block mb-1">
              <Icon name="accessibility_new" size={14} className="inline mr-1" />
              {labels.jointPain}: {jointPain}/10
            </label>
            <input type="range" min="0" max="10" value={jointPain} onChange={e => setJointPain(Number(e.target.value))}
              className="w-full accent-accent-dark" />
          </div>

          <div>
            <label className="text-xs text-text-secondary block mb-1">
              <Icon name="thermostat" size={14} className="inline mr-1" />
              {labels.hotFlashes}: {hotFlashes}/10
            </label>
            <input type="range" min="0" max="10" value={hotFlashes} onChange={e => setHotFlashes(Number(e.target.value))}
              className="w-full accent-accent-dark" />
          </div>

          <div>
            <label className="text-xs text-text-secondary block mb-1">
              <Icon name="mood" size={14} className="inline mr-1" />
              {labels.mood}: {mood}/10
            </label>
            <input type="range" min="1" max="10" value={mood} onChange={e => setMood(Number(e.target.value))}
              className="w-full accent-accent-dark" />
          </div>

          <div>
            <label className="text-xs text-text-secondary block mb-1">
              <Icon name="battery_low" size={14} className="inline mr-1" />
              {labels.fatigue}: {fatigue}/10
            </label>
            <input type="range" min="0" max="10" value={fatigue} onChange={e => setFatigue(Number(e.target.value))}
              className="w-full accent-accent-dark" />
          </div>
        </div>

        <div>
          <label className="text-xs text-text-secondary block mb-1">{t.common.notes}</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            rows={2} className="w-full rounded-lg border border-border px-3 py-2 text-xs bg-bg-primary resize-y" />
        </div>

        <p className="text-[10px] text-text-secondary text-center">
          {labels.adherenceNote}
        </p>

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
          onRemove={drug => setPendingUnknowns(prev => prev ? prev.filter(d => d !== drug) : null)}
        />
      )}
    </Card>
  );
}
