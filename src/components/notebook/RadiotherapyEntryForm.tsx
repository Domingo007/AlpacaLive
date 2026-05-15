import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { Card } from '@/components/shared/Card';
import { useI18n } from '@/lib/i18n';

const CTCAE_GRADES = [
  { value: 0, label: { pl: '0 — Brak zmian', en: '0 — No changes', de: '0 — Keine Veränderungen' } },
  { value: 1, label: { pl: '1 — Lekkie zaczerwienienie', en: '1 — Faint erythema', de: '1 — Leichtes Erythem' } },
  { value: 2, label: { pl: '2 — Umiarkowane zaczerwienienie, obrzęk', en: '2 — Moderate erythema, edema', de: '2 — Mäßiges Erythem, Ödem' } },
  { value: 3, label: { pl: '3 — Wilgotne złuszczanie, krwawienie', en: '3 — Moist desquamation, bleeding', de: '3 — Feuchte Desquamation, Blutung' } },
  { value: 4, label: { pl: '4 — Martwica skóry, owrzodzenie', en: '4 — Skin necrosis, ulceration', de: '4 — Hautnekrose, Ulzeration' } },
];

export function RadiotherapyEntryForm() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [fractionNumber, setFractionNumber] = useState('1');
  const [doseGy, setDoseGy] = useState('2.0');
  const [skinToxicity, setSkinToxicity] = useState(0);
  const [fatigue, setFatigue] = useState(3);
  const [pain, setPain] = useState(0);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const { t, lang } = useI18n();

  async function handleSave() {
    if (!date) return;
    await db.treatmentSessions.put({
      id: uuidv4(),
      date,
      treatmentType: 'radiotherapy',
      status: 'completed',
      details: {
        fractionNumber: parseInt(fractionNumber) || 1,
        doseGy: parseFloat(doseGy) || 2.0,
        cumulativeDoseGy: (parseInt(fractionNumber) || 1) * (parseFloat(doseGy) || 2.0),
        skinToxicity,
        fatigue,
        pain,
      },
      notes: notes || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    // Auto-increment fraction for next entry
    setFractionNumber(String((parseInt(fractionNumber) || 1) + 1));
    setNotes('');
  }

  const labels = lang === 'pl' ? {
    title: 'Sesja radioterapii',
    fraction: 'Numer frakcji',
    dose: 'Dawka (Gy)',
    skinToxicity: 'Toksyczność skóry (CTCAE)',
    fatigue: 'Zmęczenie',
    pain: 'Ból w polu RT',
    save: 'Zapisz sesję RT',
    savedMsg: 'Zapisano!',
    cumulativeDose: 'Dawka kumulacyjna',
  } : {
    title: 'Radiotherapy session',
    fraction: 'Fraction number',
    dose: 'Dose (Gy)',
    skinToxicity: 'Skin toxicity (CTCAE)',
    fatigue: 'Fatigue',
    pain: 'Pain in RT field',
    save: 'Save RT session',
    savedMsg: 'Saved!',
    cumulativeDose: 'Cumulative dose',
  };

  const cumDose = ((parseInt(fractionNumber) || 1) * (parseFloat(doseGy) || 2.0)).toFixed(1);

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
            <label className="text-xs text-text-secondary block mb-1">{labels.fraction}</label>
            <input type="number" value={fractionNumber} onChange={e => setFractionNumber(e.target.value)}
              min="1" className="w-full rounded-lg border border-border px-3 py-2 text-xs bg-bg-primary" />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">{labels.dose}</label>
            <input type="number" value={doseGy} onChange={e => setDoseGy(e.target.value)}
              step="0.1" className="w-full rounded-lg border border-border px-3 py-2 text-xs bg-bg-primary" />
          </div>
        </div>

        <div className="text-xs text-accent-dark bg-accent-warm/30 rounded-lg px-3 py-1.5">
          {labels.cumulativeDose}: <strong>{cumDose} Gy</strong>
        </div>

        <div>
          <label className="text-xs text-text-secondary block mb-1">{labels.skinToxicity}</label>
          <div className="space-y-1">
            {CTCAE_GRADES.map(grade => (
              <button
                key={grade.value}
                onClick={() => setSkinToxicity(grade.value)}
                className={`w-full text-left rounded-lg px-3 py-1.5 text-[11px] border transition-colors ${
                  skinToxicity === grade.value
                    ? 'border-accent-dark bg-accent-warm/20 font-medium'
                    : 'border-border bg-bg-primary'
                }`}
              >
                {grade.label[lang] || grade.label.en}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-text-secondary block mb-1">{labels.fatigue}: {fatigue}/10</label>
          <input type="range" min="0" max="10" value={fatigue} onChange={e => setFatigue(Number(e.target.value))}
            className="w-full accent-accent-dark" />
        </div>

        <div>
          <label className="text-xs text-text-secondary block mb-1">{labels.pain}: {pain}/10</label>
          <input type="range" min="0" max="10" value={pain} onChange={e => setPain(Number(e.target.value))}
            className="w-full accent-accent-dark" />
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
    </Card>
  );
}
