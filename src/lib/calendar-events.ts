/*
 * AlpacaLive — Your Companion Through Cancer Treatment
 * Copyright (C) 2025 AlpacaLive Contributors
 * Licensed under AGPL-3.0 — see LICENSE file
 */
import { db } from './db';
import { CHEMO_PHASES, findPhaseForDay } from './treatment-cycle';
import type { CalendarEvent, CalendarEventType } from '@/types';

type CalendarLang = 'pl' | 'en' | 'de';

const LABELS: Record<CalendarLang, Record<CalendarEventType, string>> = {
  pl: {
    chemo: 'Chemioterapia',
    chemo_postponed: 'Chemia odroczona',
    blood_test: 'Wyniki krwi',
    imaging: 'Badanie obrazowe',
    daily_log: 'Dziennik',
    supplement: 'Suplementy',
    doctor_visit: 'Wizyta lekarska',
    side_effect: 'Efekt uboczny',
    weight: 'Waga',
    wearable_alert: 'Alert opaski',
    prediction: 'Wzorzec',
    medication_change: 'Zmiana leczenia',
    note: 'Notatka',
    radiotherapy_session: 'Radioterapia',
    immunotherapy_infusion: 'Immunoterapia',
    targeted_therapy: 'Terapia celowana',
    hormonal_therapy: 'Hormonoterapia',
    surgery: 'Operacja',
    surgery_followup: 'Kontrola pooperacyjna',
    recovery_period: 'Rekonwalescencja',
    phase_a: 'Faza A',
    phase_b: 'Faza B',
    phase_c: 'Faza C',
  },
  en: {
    chemo: 'Chemotherapy',
    chemo_postponed: 'Chemo postponed',
    blood_test: 'Blood results',
    imaging: 'Imaging study',
    daily_log: 'Journal',
    supplement: 'Supplements',
    doctor_visit: 'Doctor visit',
    side_effect: 'Side effect',
    weight: 'Weight',
    wearable_alert: 'Wearable alert',
    prediction: 'Pattern',
    medication_change: 'Medication change',
    note: 'Note',
    radiotherapy_session: 'Radiotherapy',
    immunotherapy_infusion: 'Immunotherapy',
    targeted_therapy: 'Targeted therapy',
    hormonal_therapy: 'Hormonal therapy',
    surgery: 'Surgery',
    surgery_followup: 'Post-op checkup',
    recovery_period: 'Recovery',
    phase_a: 'Phase A',
    phase_b: 'Phase B',
    phase_c: 'Phase C',
  },
  de: {
    chemo: 'Chemotherapie',
    chemo_postponed: 'Chemo verschoben',
    blood_test: 'Blutwerte',
    imaging: 'Bildgebung',
    daily_log: 'Tagebuch',
    supplement: 'Ergänzungen',
    doctor_visit: 'Arztbesuch',
    side_effect: 'Nebenwirkung',
    weight: 'Gewicht',
    wearable_alert: 'Wearable-Warnung',
    prediction: 'Muster',
    medication_change: 'Medikamentenwechsel',
    note: 'Notiz',
    radiotherapy_session: 'Strahlentherapie',
    immunotherapy_infusion: 'Immuntherapie',
    targeted_therapy: 'Zielgerichtete Therapie',
    hormonal_therapy: 'Hormontherapie',
    surgery: 'Operation',
    surgery_followup: 'Postoperative Kontrolle',
    recovery_period: 'Genesungsphase',
    phase_a: 'Phase A',
    phase_b: 'Phase B',
    phase_c: 'Phase C',
  },
};

const COLORS: Record<CalendarEventType, { color: string; icon: string }> = {
  chemo:              { color: '#e74c3c', icon: 'vaccines' },
  chemo_postponed:    { color: '#c0392b', icon: 'pause_circle' },
  blood_test:         { color: '#3498db', icon: 'water_drop' },
  imaging:            { color: '#9b59b6', icon: 'imagesmode' },
  daily_log:          { color: '#27ae60', icon: 'edit_note' },
  supplement:         { color: '#f39c12', icon: 'medication' },
  doctor_visit:       { color: '#1abc9c', icon: 'stethoscope' },
  side_effect:        { color: '#e67e22', icon: 'warning' },
  weight:             { color: '#7f8c8d', icon: 'scale' },
  wearable_alert:     { color: '#c0392b', icon: 'watch' },
  prediction:         { color: '#2c3e50', icon: 'auto_graph' },
  medication_change:  { color: '#d35400', icon: 'sync' },
  note:               { color: '#95a5a6', icon: 'push_pin' },
  radiotherapy_session:   { color: '#f59e0b', icon: 'radiology' },
  immunotherapy_infusion: { color: '#06b6d4', icon: 'shield' },
  targeted_therapy:       { color: '#8b5cf6', icon: 'target' },
  hormonal_therapy:       { color: '#ec4899', icon: 'medication' },
  surgery:                { color: '#7c3aed', icon: 'local_hospital' },
  surgery_followup:       { color: '#a78bfa', icon: 'healing' },
  recovery_period:        { color: '#ede9fe20', icon: '' },
  phase_a:            { color: '#e74c3c20', icon: '' },
  phase_b:            { color: '#f39c1220', icon: '' },
  phase_c:            { color: '#27ae6020', icon: '' },
};

export function getEventColors(lang: CalendarLang = 'pl'): Record<CalendarEventType, { color: string; icon: string; label: string }> {
  const labels = LABELS[lang] || LABELS.pl;
  const result = {} as Record<CalendarEventType, { color: string; icon: string; label: string }>;
  for (const key of Object.keys(COLORS) as CalendarEventType[]) {
    result[key] = { ...COLORS[key], label: labels[key] };
  }
  return result;
}

// Backwards-compat for non-React callers
export const DEFAULT_EVENT_COLORS = getEventColors('pl');

// Title pieces used inside event names (e.g. "Chemia #4", "Krew: WBC↓", "Energia: 6/10")
const TITLES: Record<CalendarLang, {
  chemo: (cycle: number) => string;
  chemoPostponed: (to: string) => string;
  blood: 'Krew' | 'Blood' | 'Blut';
  energy: 'Energia' | 'Energy' | 'Energie';
  pain: 'Ból' | 'Pain' | 'Schmerz';
  nausea: 'Nudności' | 'Nausea' | 'Übelkeit';
  supplements: (taken: number, total: number) => string;
}> = {
  pl: {
    chemo: (cycle) => `Chemia #${cycle}`,
    chemoPostponed: (to) => `Chemia odroczona → ${to}`,
    blood: 'Krew', energy: 'Energia', pain: 'Ból', nausea: 'Nudności',
    supplements: (t, n) => `Suplementy ${t}/${n}`,
  },
  en: {
    chemo: (cycle) => `Chemo #${cycle}`,
    chemoPostponed: (to) => `Chemo postponed → ${to}`,
    blood: 'Blood', energy: 'Energy', pain: 'Pain', nausea: 'Nausea',
    supplements: (t, n) => `Supplements ${t}/${n}`,
  },
  de: {
    chemo: (cycle) => `Chemo #${cycle}`,
    chemoPostponed: (to) => `Chemo verschoben → ${to}`,
    blood: 'Blut', energy: 'Energie', pain: 'Schmerz', nausea: 'Übelkeit',
    supplements: (t, n) => `Ergänzungen ${t}/${n}`,
  },
};

export async function buildCalendarEvents(lang: CalendarLang = 'pl'): Promise<CalendarEvent[]> {
  const COLORS_LOCALIZED = getEventColors(lang);
  const T = TITLES[lang] || TITLES.pl;
  const events: CalendarEvent[] = [];

  const [chemos, bloods, dailies, imagings, wearables, supplements, notes] = await Promise.all([
    db.chemo.toArray(),
    db.blood.toArray(),
    db.daily.toArray(),
    db.imaging.toArray(),
    db.wearable.toArray(),
    db.supplements.toArray(),
    db.calendarNotes.toArray(),
  ]);

  // CHEMO
  for (const c of chemos) {
    events.push({
      id: `chemo-${c.id}`,
      date: c.actualDate || c.date,
      type: c.status === 'postponed' ? 'chemo_postponed' : 'chemo',
      title: c.status === 'postponed' ? T.chemoPostponed(c.postponedTo || '?') : T.chemo(c.cycle),
      subtitle: c.drugs?.join(' + '),
      color: COLORS_LOCALIZED[c.status === 'postponed' ? 'chemo_postponed' : 'chemo'].color,
      icon: c.status === 'postponed' ? '⏸️' : '💉',
      sourceId: c.id, sourceType: 'chemo',
      editable: true, allDay: true,
      data: { drugs: c.drugs, notes: c.notes, postponeReason: c.postponeReason },
    });
  }

  // PHASE BACKGROUNDS (dynamic from treatment cycle definitions)
  const completedChemos = chemos
    .filter(c => c.status === 'completed' || c.status === 'modified')
    .sort((a, b) => (a.actualDate || a.date).localeCompare(b.actualDate || b.date));

  for (const chemo of completedChemos) {
    const chemoDate = new Date(chemo.actualDate || chemo.date);
    for (let d = 0; d <= 21; d++) {
      const date = new Date(chemoDate);
      date.setDate(chemoDate.getDate() + d);
      const dateStr = date.toISOString().split('T')[0];
      const phaseDef = findPhaseForDay(d, CHEMO_PHASES);
      const phaseKey = phaseDef?.id === 'crisis' ? 'a' : phaseDef?.id === 'recovery' ? 'b' : 'c';
      events.push({
        id: `phase-${dateStr}-${chemo.id}`,
        date: dateStr,
        type: `phase_${phaseKey}` as CalendarEventType,
        title: '', color: COLORS_LOCALIZED[`phase_${phaseKey}` as CalendarEventType].color,
        icon: '', editable: false, allDay: true,
        data: { phase: phaseKey.toUpperCase(), dayInCycle: d, treatmentType: 'chemotherapy' },
      });
    }
  }

  // TREATMENT SESSIONS (from generic table)
  const treatmentSessionsList = await db.treatmentSessions.toArray();
  for (const session of treatmentSessionsList) {
    const typeConfig = COLORS_LOCALIZED[
      session.treatmentType === 'radiotherapy' ? 'radiotherapy_session' :
      session.treatmentType === 'immunotherapy' ? 'immunotherapy_infusion' :
      session.treatmentType === 'targeted_therapy' ? 'targeted_therapy' :
      session.treatmentType === 'hormonal_therapy' ? 'hormonal_therapy' :
      'note'
    ];
    if (typeConfig) {
      events.push({
        id: `ts-${session.id}`,
        date: session.date,
        type: (session.treatmentType === 'radiotherapy' ? 'radiotherapy_session' :
               session.treatmentType === 'immunotherapy' ? 'immunotherapy_infusion' :
               session.treatmentType === 'targeted_therapy' ? 'targeted_therapy' :
               session.treatmentType === 'hormonal_therapy' ? 'hormonal_therapy' :
               'note') as CalendarEventType,
        title: `${typeConfig.label}${session.notes ? ': ' + session.notes : ''}`,
        color: typeConfig.color,
        icon: typeConfig.icon,
        sourceId: session.id,
        sourceType: 'treatmentSession',
        editable: true,
        allDay: true,
      });
    }
  }

  // BLOOD
  for (const b of bloods) {
    const alerts: string[] = [];
    if (b.markers.wbc !== undefined && b.markers.wbc < 2) alerts.push('WBC↓');
    if (b.markers.hgb !== undefined && b.markers.hgb < 8) alerts.push('Hgb↓');
    if (b.markers.plt !== undefined && b.markers.plt < 50) alerts.push('PLT↓');
    events.push({
      id: `blood-${b.id}`, date: b.date, type: 'blood_test',
      title: `${T.blood}${alerts.length ? ': ' + alerts.join(', ') : ''}`,
      subtitle: Object.entries(b.markers).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(', '),
      color: alerts.length ? '#e74c3c' : COLORS_LOCALIZED.blood_test.color,
      icon: alerts.length ? '🔴' : '🩸',
      sourceId: b.id, sourceType: 'blood', editable: true, allDay: true, data: b.markers as Record<string, unknown>,
    });
  }

  // IMAGING
  for (const img of imagings) {
    events.push({
      id: `img-${img.id}`, date: img.date, type: 'imaging',
      title: `${img.type} ${img.bodyRegion || ''}`.trim(),
      subtitle: img.radiologistReport?.extractedData?.conclusion || img.notes || undefined,
      color: COLORS_LOCALIZED.imaging.color, icon: '🏥',
      sourceId: img.id, sourceType: 'imaging', editable: true, allDay: true,
    });
  }

  // DAILY LOGS
  for (const d of dailies) {
    events.push({
      id: `daily-${d.id}`, date: d.date, type: 'daily_log',
      title: `${T.energy}: ${d.energy}/10`,
      subtitle: [d.pain > 3 ? `${T.pain}: ${d.pain}` : null, d.nausea > 3 ? `${T.nausea}: ${d.nausea}` : null, d.weight ? `${d.weight}kg` : null].filter(Boolean).join(', ') || undefined,
      color: d.energy <= 3 ? '#e74c3c' : d.energy <= 6 ? '#f39c12' : COLORS_LOCALIZED.daily_log.color,
      icon: d.energy <= 3 ? '😞' : d.energy <= 6 ? '😐' : '😊',
      sourceId: d.id, sourceType: 'daily', editable: true, allDay: true,
      data: { energy: d.energy, pain: d.pain, nausea: d.nausea, mood: d.mood, weight: d.weight },
    });
  }

  // WEARABLE ALERTS
  for (const w of wearables) {
    if (w.rhr > 85 || w.spo2 < 94) {
      events.push({
        id: `wear-${w.id}`, date: w.date, type: 'wearable_alert',
        title: w.rhr > 85 ? `RHR ${w.rhr} bpm ⚠️` : `SpO2 ${w.spo2}% ⚠️`,
        color: COLORS_LOCALIZED.wearable_alert.color, icon: '⌚',
        sourceId: w.id, sourceType: 'wearable', editable: false, allDay: true,
        data: { rhr: w.rhr, spo2: w.spo2, hrv: w.hrv },
      });
    }
  }

  // SUPPLEMENTS
  for (const s of supplements) {
    const taken = s.supplements.filter(x => x.taken).length;
    const total = s.supplements.length;
    if (total > 0) {
      events.push({
        id: `supp-${s.id}`, date: s.date, type: 'supplement',
        title: T.supplements(taken, total),
        color: COLORS_LOCALIZED.supplement.color, icon: '💊',
        sourceId: s.id, sourceType: 'supplements', editable: false, allDay: true,
      });
    }
  }

  // CALENDAR NOTES (doctor visits, notes)
  for (const n of notes) {
    events.push({
      id: `note-${n.id}`, date: n.date, type: n.type,
      title: n.title, subtitle: n.description,
      color: COLORS_LOCALIZED[n.type].color,
      icon: COLORS_LOCALIZED[n.type].icon,
      editable: true, allDay: !n.time, time: n.time,
    });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

export function getEventsForDate(events: CalendarEvent[], date: string): CalendarEvent[] {
  return events.filter(e => e.date === date && !e.type.startsWith('phase_'));
}

export function getPhaseForDate(events: CalendarEvent[], date: string): string | null {
  const phase = events.find(e => e.date === date && e.type.startsWith('phase_'));
  return phase ? (phase.data?.phase as string) || null : null;
}

export function getUpcomingEvents(events: CalendarEvent[], days = 7): CalendarEvent[] {
  const today = new Date();
  const end = new Date();
  end.setDate(today.getDate() + days);
  const todayStr = today.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];
  return events.filter(e => e.date >= todayStr && e.date <= endStr && !e.type.startsWith('phase_') && e.title);
}
