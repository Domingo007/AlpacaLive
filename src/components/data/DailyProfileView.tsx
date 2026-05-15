import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { buildDailyProfile, type DailyProfile } from '@/lib/daily-profile';
import { getPhaseColor, getPhaseLabel } from '@/lib/treatment-cycle';
import { usePatient } from '@/hooks/useDatabase';
import { db } from '@/lib/db';
import { Card } from '@/components/shared/Card';
import { Icon } from '@/components/shared/Icon';
import { DisclaimerBanner } from '@/components/shared/DisclaimerBanner';
import { useI18n } from '@/lib/i18n';

export function DailyProfileView() {
  const { patient } = usePatient();
  const [profile, setProfile] = useState<DailyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const { lang } = useI18n();

  // Quick entry state
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [qEnergy, setQEnergy] = useState(5);
  const [qPain, setQPain] = useState(0);
  const [qNausea, setQNausea] = useState(0);
  const [qMood, setQMood] = useState(5);
  const [qAppetite, setQAppetite] = useState(5);

  useEffect(() => {
    if (!patient) return;
    setLoading(true);
    buildDailyProfile(date, patient).then(p => {
      setProfile(p);
      setShowQuickEntry(!p.patientReported);
      setLoading(false);
    });
  }, [patient, date]);

  const l = lang === 'pl' ? {
    title: 'Twój profil dnia',
    devices: 'Dane z urządzeń',
    feelings: 'Twoje odczucia',
    history: 'Twoje poprzednie cykle',
    noData: 'Brak danych na ten dzień',
    sleep: 'Sen', rhr: 'Tętno spocz.', hrv: 'HRV', spo2: 'SpO2',
    bp: 'Ciśnienie', weight: 'Waga', steps: 'Kroki', temp: 'Temperatura',
    energy: 'Energia', pain: 'Ból', nausea: 'Nudności', mood: 'Nastrój', appetite: 'Apetyt',
    yourAvg: 'Twoja średnia', basedOn: 'na podstawie',
    howAreYou: 'Jak się dziś czujesz?', save: 'Zapisz i zobacz profil',
    connectDevice: 'Podłącz urządzenie (zegarek, wagę) aby zobaczyć pełny profil.',
    disclaimer: 'Profil oparty na Twoich danych. Nie stanowi oceny zdrowia. Porównanie z Twoimi własnymi danymi. Konsultuj z lekarzem.',
    dataSources: 'Źródła danych',
    alerts: 'Uwagi wymagające kontaktu z lekarzem',
    neuropathy: 'Neuropatia',
    cycle: 'Cykl',
    day: 'Dzień',
    phase: 'Faza',
    active: 'Aktywne minuty',
  } : lang === 'de' ? {
    title: 'Ihr Tagesprofil',
    devices: 'Gerätedaten',
    feelings: 'Ihre Empfindungen',
    history: 'Ihre vorherigen Zyklen',
    noData: 'Keine Daten für diesen Tag',
    sleep: 'Schlaf', rhr: 'Ruhe-HF', hrv: 'HRV', spo2: 'SpO2',
    bp: 'Blutdruck', weight: 'Gewicht', steps: 'Schritte', temp: 'Temperatur',
    energy: 'Energie', pain: 'Schmerz', nausea: 'Übelkeit', mood: 'Stimmung', appetite: 'Appetit',
    yourAvg: 'Ihr Durchschnitt', basedOn: 'basierend auf',
    howAreYou: 'Wie fühlen Sie sich heute?', save: 'Speichern und Profil anzeigen',
    connectDevice: 'Verbinden Sie ein Gerät (Uhr, Waage), um das vollständige Profil zu sehen.',
    disclaimer: 'Profil basierend auf Ihren Daten. Keine Gesundheitsbewertung. Vergleich nur mit Ihren eigenen Daten. Konsultieren Sie Ihren Arzt.',
    dataSources: 'Datenquellen',
    alerts: 'Hinweise, die ärztlichen Kontakt erfordern',
    neuropathy: 'Neuropathie',
    cycle: 'Zyklus',
    day: 'Tag',
    phase: 'Phase',
    active: 'Aktive Minuten',
  } : {
    title: 'Your daily profile',
    devices: 'Device data',
    feelings: 'Your feelings',
    history: 'Your previous cycles',
    noData: 'No data for this day',
    sleep: 'Sleep', rhr: 'Resting HR', hrv: 'HRV', spo2: 'SpO2',
    bp: 'Blood pressure', weight: 'Weight', steps: 'Steps', temp: 'Temperature',
    energy: 'Energy', pain: 'Pain', nausea: 'Nausea', mood: 'Mood', appetite: 'Appetite',
    yourAvg: 'Your average', basedOn: 'based on',
    howAreYou: 'How are you feeling today?', save: 'Save & see profile',
    connectDevice: 'Connect a device (watch, scale) to see the full profile.',
    disclaimer: 'Profile based on your data. Not a health assessment. Comparison with your own data only. Consult your doctor.',
    dataSources: 'Data sources',
    alerts: 'Alerts requiring doctor contact',
    neuropathy: 'Neuropathy',
    cycle: 'Cycle',
    day: 'Day',
    phase: 'Phase',
    active: 'Active minutes',
  };

  async function handleQuickSave() {
    await db.daily.put({
      id: uuidv4(), date, time: new Date().toTimeString().slice(0, 5),
      energy: qEnergy, pain: qPain, nausea: qNausea, mood: qMood,
      neuropathy: 0, appetite: qAppetite, notes: '', chemoPhase: null, dayInCycle: 0,
    } as any);
    if (patient) {
      const p = await buildDailyProfile(date, patient);
      setProfile(p);
      setShowQuickEntry(false);
    }
  }

  function shiftDate(delta: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split('T')[0]);
  }

  if (loading || !profile) {
    return <div className="text-center py-12 text-text-secondary text-sm">{lang === 'pl' ? 'Ładowanie...' : lang === 'de' ? 'Wird geladen...' : 'Loading...'}</div>;
  }

  const today = new Date().toISOString().split('T')[0];
  const isToday = date === today;
  const ctx = profile.treatmentContext;
  const locale = lang === 'pl' ? 'pl-PL' : lang === 'de' ? 'de-DE' : 'en-US';
  const dateLabel = new Date(date + 'T12:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-3">
      {/* Alerts — OUTSIDE profile, separate */}
      {profile.alerts.length > 0 && (
        <div className="space-y-1.5">
          {profile.alerts.map((alert, i) => (
            <div key={i} className={`rounded-xl px-3 py-2.5 flex items-start gap-2 ${
              alert.type === 'critical' ? 'bg-alert-critical/10 border border-alert-critical/30' : 'bg-alert-warning/10 border border-alert-warning/30'
            }`}>
              <Icon name={alert.type === 'critical' ? 'emergency' : 'warning'} size={18}
                className={alert.type === 'critical' ? 'text-alert-critical shrink-0 mt-0.5' : 'text-alert-warning shrink-0 mt-0.5'} />
              <div>
                <div className={`text-xs font-medium ${alert.type === 'critical' ? 'text-alert-critical' : 'text-alert-warning'}`}>
                  {alert.value && <span className="font-bold mr-1">{alert.value}</span>}
                  {alert.message}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Header with date nav */}
      <Card title="">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <button onClick={() => shiftDate(-1)} className="p-1"><Icon name="chevron_left" size={22} className="text-accent-dark" /></button>
            <div className="text-center">
              <div className="text-xs font-semibold text-accent-dark capitalize">{dateLabel}</div>
              {ctx.cycleName && ctx.cycleDay !== null && ctx.chemoPhase && (
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-[10px] text-text-secondary">{ctx.cycleName}</span>
                  <span className="text-[10px] text-text-secondary">·</span>
                  <span className="text-[10px] text-text-secondary">{l.day} {ctx.cycleDay}</span>
                  <span className="text-[10px] text-text-secondary">·</span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{
                    backgroundColor: getPhaseColor(ctx.chemoPhase) + '20',
                    color: getPhaseColor(ctx.chemoPhase),
                  }}>{l.phase} {ctx.chemoPhase} — {getPhaseLabel(ctx.chemoPhase)}</span>
                </div>
              )}
              {ctx.activeTreatments.length > 0 && (
                <div className="text-[10px] text-text-tertiary mt-0.5">{ctx.activeTreatments.join(' + ')}</div>
              )}
            </div>
            <button onClick={() => shiftDate(1)} className="p-1" disabled={isToday}>
              <Icon name="chevron_right" size={22} className={isToday ? 'text-text-tertiary' : 'text-accent-dark'} />
            </button>
          </div>
        </div>
      </Card>

      {/* Quick entry (if no log today) */}
      {isToday && showQuickEntry && (
        <Card title={l.howAreYou}>
          <div className="space-y-2.5">
            <QuickSlider label={l.energy} icon="bolt" value={qEnergy} onChange={setQEnergy} max={10} min={1} />
            <QuickSlider label={l.pain} icon="healing" value={qPain} onChange={setQPain} max={10} min={0} />
            <QuickSlider label={l.nausea} icon="sick" value={qNausea} onChange={setQNausea} max={10} min={0} />
            <QuickSlider label={l.mood} icon="mood" value={qMood} onChange={setQMood} max={10} min={1} />
            <QuickSlider label={l.appetite} icon="restaurant" value={qAppetite} onChange={setQAppetite} max={10} min={1} />
            <button onClick={handleQuickSave} className="w-full bg-accent-dark text-white rounded-xl py-2.5 text-sm font-medium">
              {l.save}
            </button>
          </div>
        </Card>
      )}

      {/* Device data */}
      {(profile.deviceData.sleep || profile.deviceData.rhr || profile.deviceData.steps || profile.deviceData.weight) ? (
        <Card title={l.devices}>
          <div className="space-y-3">
            {profile.deviceData.sleep && (
              <MetricBar label={l.sleep} icon="bedtime" value={`${profile.deviceData.sleep.hours.toFixed(1)}h`}
                detail={[profile.deviceData.sleep.deep ? `${lang === 'pl' ? 'Głęboki' : lang === 'de' ? 'Tief' : 'Deep'}: ${profile.deviceData.sleep.deep.toFixed(1)}h` : null, profile.deviceData.sleep.rem ? `REM: ${profile.deviceData.sleep.rem.toFixed(1)}h` : null].filter(Boolean).join(' · ')}
                current={profile.deviceData.sleep.hours} baseline={profile.baseline.sleepHours} max={10} baselineLabel={l.yourAvg} />
            )}
            {profile.deviceData.rhr && (
              <MetricBar label={l.rhr} icon="favorite" value={`${profile.deviceData.rhr} bpm`}
                current={profile.deviceData.rhr} baseline={profile.baseline.rhr} max={120} baselineLabel={l.yourAvg} />
            )}
            {profile.deviceData.spo2 && (
              <MetricBar label={l.spo2} icon="pulmonology" value={`${profile.deviceData.spo2}%`}
                current={profile.deviceData.spo2} baseline={profile.baseline.spo2} max={100} baselineLabel={l.yourAvg} />
            )}
            {profile.deviceData.bloodPressure && (
              <MetricRow label={l.bp} icon="stethoscope" value={`${profile.deviceData.bloodPressure.systolic}/${profile.deviceData.bloodPressure.diastolic} mmHg`} />
            )}
            {profile.deviceData.weight && (
              <MetricRow label={l.weight} icon="scale" value={`${profile.deviceData.weight} kg`}
                baseline={profile.baseline.weight ? `${profile.baseline.weight.toFixed(1)} kg` : undefined} baselineLabel={l.yourAvg} />
            )}
            {profile.deviceData.temperature && (
              <MetricRow label={l.temp} icon="thermostat" value={`${profile.deviceData.temperature}°C`} />
            )}
            {profile.deviceData.steps !== null && profile.deviceData.steps !== undefined && (
              <MetricBar label={l.steps} icon="directions_walk" value={profile.deviceData.steps.toLocaleString()}
                current={profile.deviceData.steps} baseline={profile.baseline.steps} max={15000} baselineLabel={l.yourAvg} />
            )}
          </div>
        </Card>
      ) : isToday ? (
        <Card title={l.devices}>
          <div className="text-center py-4 text-xs text-text-secondary space-y-2">
            <Icon name="watch" size={28} className="mx-auto text-lavender-300" />
            <p>{l.connectDevice}</p>
          </div>
        </Card>
      ) : null}

      {/* Patient reported */}
      {profile.patientReported && (
        <Card title={l.feelings}>
          <div className="space-y-2">
            <FeelingBar label={l.energy} icon="bolt" value={profile.patientReported.energy} max={10}
              baseline={profile.baseline.energy} baselineLabel={l.yourAvg} />
            <FeelingBar label={l.pain} icon="healing" value={profile.patientReported.pain} max={10} />
            <FeelingBar label={l.nausea} icon="sick" value={profile.patientReported.nausea} max={10} />
            <FeelingBar label={l.mood} icon="mood" value={profile.patientReported.mood} max={10} />
            <FeelingBar label={l.appetite} icon="restaurant" value={profile.patientReported.appetite} max={10} />
          </div>
        </Card>
      )}

      {/* AI Clinical Findings */}
      {profile.aiExtracted && profile.aiExtracted.clinicalFindings.length > 0 && (
        <Card title={lang === 'pl' ? 'Objawy wyciągnięte z rozmowy' : lang === 'de' ? 'Symptome aus dem Gespräch' : 'Symptoms extracted from conversation'}>
          <div className="space-y-2">
            {profile.aiExtracted.clinicalFindings.map((f, i) => (
              <div key={i} className="bg-lavender-50 rounded-lg p-2.5 space-y-1">
                <div className="flex items-start gap-2">
                  <span className="text-alert-warning mt-0.5">◆</span>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-text-primary">
                      {f.finding.replace(/_/g, ' ')}{f.grade ? ` — ${lang === 'pl' ? 'stopień' : lang === 'de' ? 'Grad' : 'grade'} ${f.grade}` : ''}
                      {f.grading ? ` (${f.grading})` : ''}
                    </div>
                    <div className="text-[11px] text-text-secondary">{f.details}</div>
                    {f.relatedDrug && (
                      <div className="text-[10px] text-text-tertiary">{lang === 'pl' ? 'Powiązane z' : lang === 'de' ? 'Verbunden mit' : 'Related to'}: {f.relatedDrug}</div>
                    )}
                    <div className="text-[10px] text-lavender-600 italic mt-0.5">"{f.basis}"</div>
                    {f.actionSuggested && (
                      <div className="text-[10px] text-accent-dark mt-1">{f.actionSuggested}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {profile.aiExtracted.ecogEstimate && (
              <div className="bg-lavender-50 rounded-lg p-2.5">
                <div className="text-xs font-semibold text-text-primary">ECOG: {profile.aiExtracted.ecogEstimate.value}/4</div>
                <div className="text-[10px] text-text-secondary">{profile.aiExtracted.ecogEstimate.basis}</div>
                {profile.aiExtracted.ecogEstimate.note && (
                  <div className="text-[10px] text-text-tertiary italic mt-0.5">{profile.aiExtracted.ecogEstimate.note}</div>
                )}
              </div>
            )}
            <p className="text-[9px] text-text-tertiary italic">
              {lang === 'pl'
                ? 'Objawy wyciągnięte przez AI z rozmowy. Nie stanowią diagnozy. Omów z lekarzem.'
                : lang === 'de'
                ? 'Symptome, die von der KI aus dem Gespräch extrahiert wurden. Keine Diagnose. Mit Ihrem Arzt besprechen.'
                : 'Symptoms extracted by AI from conversation. Not a diagnosis. Discuss with your doctor.'}
            </p>
          </div>
        </Card>
      )}

      {/* AI suggestion when no extraction exists */}
      {!profile.aiExtracted && profile.patientReported && (
        <div className="bg-lavender-50 rounded-xl px-3 py-2.5 flex items-start gap-2">
          <Icon name="smart_toy" size={16} className="text-lavender-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-text-secondary leading-relaxed">
            {lang === 'pl'
              ? 'Porozmawiaj z agentem AI aby uzyskać pełniejszy profil dnia. AI wyciąga z rozmowy informacje których slidery nie łapią — rodzaj bólu, objawy uboczne, stan emocjonalny.'
              : lang === 'de'
              ? 'Sprechen Sie mit dem KI-Agenten für ein reicheres Tagesprofil. Die KI extrahiert aus dem Gespräch Informationen, die Schieberegler verpassen — Schmerzart, Nebenwirkungen, emotionalen Zustand.'
              : 'Talk to the AI agent for a richer daily profile. AI extracts information from conversation that sliders miss — pain type, side effects, emotional state.'}
          </p>
        </div>
      )}

      {/* Historical context */}
      {profile.historicalContext && profile.historicalContext.sameDayEntries.length > 0 && (
        <Card title={l.history}>
          <div className="bg-lavender-50 rounded-lg p-3 space-y-2">
            <p className="text-[11px] text-text-secondary leading-relaxed">{profile.historicalContext.note}</p>
            {profile.historicalContext.sameDayEntries.length > 1 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-text-tertiary">
                      <th className="text-left py-1"></th>
                      {profile.historicalContext.sameDayEntries.map(e => (
                        <th key={e.cycleNumber} className="text-center py-1 px-2">{l.cycle} {e.cycleNumber}</th>
                      ))}
                      {profile.patientReported && <th className="text-center py-1 px-2 text-accent-dark font-bold">{isToday ? (lang === 'pl' ? 'Dziś' : lang === 'de' ? 'Heute' : 'Today') : date.slice(5)}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-0.5 text-text-secondary">{l.energy}</td>
                      {profile.historicalContext.sameDayEntries.map(e => (
                        <td key={e.cycleNumber} className="text-center py-0.5">{e.energy ?? '—'}</td>
                      ))}
                      {profile.patientReported && <td className="text-center py-0.5 font-medium text-accent-dark">{profile.patientReported.energy}</td>}
                    </tr>
                    <tr>
                      <td className="py-0.5 text-text-secondary">{l.pain}</td>
                      {profile.historicalContext.sameDayEntries.map(e => (
                        <td key={e.cycleNumber} className="text-center py-0.5">{e.pain ?? '—'}</td>
                      ))}
                      {profile.patientReported && <td className="text-center py-0.5 font-medium text-accent-dark">{profile.patientReported.pain}</td>}
                    </tr>
                    <tr>
                      <td className="py-0.5 text-text-secondary">{l.nausea}</td>
                      {profile.historicalContext.sameDayEntries.map(e => (
                        <td key={e.cycleNumber} className="text-center py-0.5">{e.nausea ?? '—'}</td>
                      ))}
                      {profile.patientReported && <td className="text-center py-0.5 font-medium text-accent-dark">{profile.patientReported.nausea}</td>}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Disclaimer */}
      <div className="text-[9px] text-text-tertiary text-center px-4 leading-relaxed">
        {l.disclaimer}
      </div>

      {profile.deviceData.source && (
        <div className="text-[9px] text-text-tertiary text-center">
          {l.dataSources}: {profile.deviceData.source}
        </div>
      )}
    </div>
  );
}

// ==================== SUB-COMPONENTS ====================

function QuickSlider({ label, icon, value, onChange, max, min }: {
  label: string; icon: string; value: number; onChange: (v: number) => void; max: number; min: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Icon name={icon} size={14} className="text-lavender-500" />
          <span className="text-xs text-text-secondary">{label}</span>
        </div>
        <span className="text-xs font-semibold text-accent-dark">{value}/{max}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-lavender-500 h-2" />
    </div>
  );
}

function MetricBar({ label, icon, value, detail, current, baseline, max, baselineLabel }: {
  label: string; icon: string; value: string; detail?: string;
  current: number; baseline: number | null; max: number; baselineLabel: string;
}) {
  const pct = Math.min(100, (current / max) * 100);
  const baselinePct = baseline ? Math.min(100, (baseline / max) * 100) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Icon name={icon} size={14} className="text-lavender-500" />
          <span className="text-xs text-text-secondary">{label}</span>
        </div>
        <span className="text-sm font-bold text-text-primary">{value}</span>
      </div>
      <div className="relative h-2 bg-lavender-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-lavender-300 to-lavender-500 transition-all"
          style={{ width: `${pct}%` }} />
        {baselinePct !== null && (
          <div className="absolute top-0 bottom-0 w-0.5 bg-lavender-700/40"
            style={{ left: `${baselinePct}%` }}
            title={baselineLabel} />
        )}
      </div>
      <div className="flex items-center justify-between mt-0.5">
        {detail && <span className="text-[9px] text-text-tertiary">{detail}</span>}
        {baseline !== null && (
          <span className="text-[9px] text-text-tertiary ml-auto">{baselineLabel}: {typeof baseline === 'number' && baseline % 1 !== 0 ? baseline.toFixed(1) : baseline}</span>
        )}
      </div>
    </div>
  );
}

function MetricRow({ label, icon, value, baseline, baselineLabel }: {
  label: string; icon: string; value: string; baseline?: string; baselineLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-1.5">
        <Icon name={icon} size={14} className="text-lavender-500" />
        <span className="text-xs text-text-secondary">{label}</span>
      </div>
      <div className="text-right">
        <span className="text-sm font-bold text-text-primary">{value}</span>
        {baseline && <span className="text-[9px] text-text-tertiary ml-2">{baselineLabel}: {baseline}</span>}
      </div>
    </div>
  );
}

function FeelingBar({ label, icon, value, max, baseline, baselineLabel }: {
  label: string; icon: string; value: number; max: number; baseline?: number | null; baselineLabel?: string;
}) {
  const pct = (value / max) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 w-20 shrink-0">
        <Icon name={icon} size={14} className="text-lavender-500" />
        <span className="text-[11px] text-text-secondary">{label}</span>
      </div>
      <div className="flex-1 relative h-2 bg-lavender-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-lavender-300 to-lavender-500" style={{ width: `${pct}%` }} />
        {baseline && (
          <div className="absolute top-0 bottom-0 w-0.5 bg-lavender-700/40" style={{ left: `${(baseline / max) * 100}%` }} />
        )}
      </div>
      <span className="text-xs font-semibold text-text-primary w-8 text-right">{value}/{max}</span>
    </div>
  );
}
