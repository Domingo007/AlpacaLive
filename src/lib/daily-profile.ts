/*
 * AlpacaLive — Daily Profile
 * Aggregates device data, patient journal, treatment context, and historical patterns
 * into a single-day view. NOT a health score — a neutral data mirror.
 */
import { db } from './db';
import { calculateChemoPhase, calculateTreatmentPhases, type TreatmentPhaseInfo } from './treatment-cycle';
import { getMergedDailyData, type MergedDailyData } from './openwearables-adapter';
import type { PatientProfile, DailyLog, BloodWork, ChemoSession, SupplementLog } from '@/types';

// ==================== TYPES ====================

export interface DailyProfile {
  date: string;
  treatmentContext: TreatmentContext;
  deviceData: DeviceDataSummary;
  patientReported: PatientReported | null;
  aiExtracted: AIExtractedData | null;
  baseline: BaselineData;
  historicalContext: HistoricalContext | null;
  supplements: SupplementLog | null;
  alerts: ProfileAlert[];
}

// ==================== AI EXTRACTION TYPES ====================

export interface AIExtractedData {
  scores: Record<string, { value: number; basis: string; confidence: number }>;
  clinicalFindings: ClinicalFinding[];
  ecogEstimate?: { value: number; basis: string; note?: string };
  flags: AIFlag[];
  extractedAt: string;
}

export interface ClinicalFinding {
  finding: string;
  grade?: number;
  grading?: string;
  details: string;
  basis: string;
  relatedDrug?: string;
  possibleCauses?: string[];
  actionSuggested?: string;
}

export interface AIFlag {
  type: 'critical' | 'attention' | 'monitor';
  message: string;
  urgency: 'high' | 'medium' | 'low';
}

export interface TreatmentContext {
  phases: TreatmentPhaseInfo[];
  cycleDay: number | null;
  cycleName: string | null;
  chemoPhase: 'A' | 'B' | 'C' | null;
  activeTreatments: string[];
  daysSinceLastChemo: number | null;
}

export interface DeviceDataSummary {
  sleep: { hours: number; deep?: number; rem?: number; light?: number; quality?: number } | null;
  rhr: number | null;
  hrv: number | null;
  spo2: number | null;
  temperature: number | null;
  bloodPressure: { systolic: number; diastolic: number } | null;
  weight: number | null;
  steps: number | null;
  activeMinutes: number | null;
  source: string | null;
}

export interface PatientReported {
  energy: number;
  pain: number;
  nausea: number;
  mood: number;
  appetite: number;
  neuropathy: number;
  notes: string;
}

export interface BaselineData {
  period: string;
  rhr: number | null;
  sleepHours: number | null;
  hrv: number | null;
  steps: number | null;
  weight: number | null;
  energy: number | null;
  spo2: number | null;
  bp: { systolic: number; diastolic: number } | null;
}

export interface HistoricalContext {
  sameDayEntries: {
    cycleNumber: number;
    date: string;
    energy?: number;
    rhr?: number;
    sleep?: number;
    pain?: number;
    nausea?: number;
  }[];
  averages: { energy: number; pain: number; nausea: number } | null;
  note: string;
}

export interface ProfileAlert {
  type: 'critical' | 'warning';
  message: string;
  value?: string;
}

// ==================== BUILDER ====================

// ==================== AI EXTRACTION STORAGE ====================

const AI_EXTRACT_STORE = 'alpacalive_ai_extracts';

export async function saveAIExtraction(date: string, data: AIExtractedData): Promise<void> {
  try {
    const store = JSON.parse(localStorage.getItem(AI_EXTRACT_STORE) || '{}');
    store[date] = data;
    // Keep last 60 days only
    const keys = Object.keys(store).sort();
    while (keys.length > 60) {
      delete store[keys.shift()!];
    }
    localStorage.setItem(AI_EXTRACT_STORE, JSON.stringify(store));
  } catch {
    // localStorage full — non-fatal
  }
}

function getAIExtraction(date: string): AIExtractedData | null {
  try {
    const store = JSON.parse(localStorage.getItem(AI_EXTRACT_STORE) || '{}');
    return store[date] || null;
  } catch {
    return null;
  }
}

// ==================== BUILDER ====================

export async function buildDailyProfile(date: string, patient: PatientProfile): Promise<DailyProfile> {
  const [allChemo, allDaily, mergedToday, todayLog, recentBlood, todaySupplements] = await Promise.all([
    db.chemo.filter(c => c.status === 'completed' || c.status === 'modified').toArray(),
    db.daily.orderBy('date').toArray(),
    getMergedDailyData(date),
    db.daily.where('date').equals(date).first(),
    db.blood.orderBy('date').reverse().limit(3).toArray(),
    db.supplements.where('date').equals(date).first(),
  ]);

  const treatmentContext = buildTreatmentContext(allChemo, patient);
  const deviceData = buildDeviceData(mergedToday, todayLog ?? null);
  const patientReported = todayLog ? buildPatientReported(todayLog) : null;
  const baseline = buildBaseline(allDaily, allChemo, db);
  const historicalContext = buildHistoricalContext(allDaily, allChemo, treatmentContext.cycleDay);
  const alerts = buildAlerts(deviceData, recentBlood);

  const aiExtracted = getAIExtraction(date);

  // Merge AI flags into alerts
  if (aiExtracted?.flags) {
    for (const flag of aiExtracted.flags) {
      if (flag.urgency === 'high') {
        alerts.push({ type: 'critical', message: flag.message });
      } else if (flag.urgency === 'medium') {
        alerts.push({ type: 'warning', message: flag.message });
      }
    }
  }

  return {
    date,
    treatmentContext,
    deviceData,
    patientReported,
    aiExtracted,
    baseline,
    historicalContext,
    supplements: todaySupplements ?? null,
    alerts,
  };
}

// ==================== CONTEXT BUILDERS ====================

function buildTreatmentContext(chemoSessions: ChemoSession[], patient: PatientProfile): TreatmentContext {
  const phases = calculateTreatmentPhases(chemoSessions, patient.chemoCycle, patient.treatments || []);
  const chemoPhaseInfo = calculateChemoPhase(chemoSessions, patient.chemoCycle);

  const activeTreatments: string[] = [];
  if (patient.currentChemo) activeTreatments.push(patient.currentChemo);
  for (const t of patient.treatments || []) {
    if (t.status === 'active' && t.type !== 'chemotherapy') {
      activeTreatments.push(t.name);
    }
  }

  const completedChemo = chemoSessions.length;

  return {
    phases,
    cycleDay: chemoPhaseInfo.dayInCycle || null,
    cycleName: completedChemo > 0 ? `Cykl #${completedChemo}` : null,
    chemoPhase: chemoPhaseInfo.chemoPhase,
    activeTreatments,
    daysSinceLastChemo: chemoPhaseInfo.dayInCycle || null,
  };
}

function buildDeviceData(merged: MergedDailyData, dailyLog: DailyLog | null): DeviceDataSummary {
  // Merged source attribution for UI: 'oura', 'whoop', 'withings', 'manual', etc.
  let attribution: string | null = null;
  if (merged.source !== 'none') {
    attribution = merged.attribution ?? merged.source;
  } else if (dailyLog) {
    attribution = 'manual';
  }

  return {
    sleep: merged.sleepHours ? {
      hours: merged.sleepHours,
      deep: merged.deepSleep || undefined,
      rem: merged.remSleep || undefined,
      light: merged.lightSleep || undefined,
    } : dailyLog?.sleep ? {
      hours: dailyLog.sleep.hours,
      deep: dailyLog.sleep.deepSleep,
      rem: dailyLog.sleep.remSleep,
      quality: dailyLog.sleep.quality,
    } : null,
    rhr: merged.rhr ?? null,
    hrv: merged.hrv ?? null,
    spo2: merged.spo2 ?? null,
    temperature: dailyLog?.temperature || merged.skinTemperature || null,
    bloodPressure: dailyLog?.bpSystolic ? { systolic: dailyLog.bpSystolic, diastolic: dailyLog.bpDiastolic || 0 } : null,
    weight: dailyLog?.weight || null,
    steps: merged.steps ?? null,
    activeMinutes: merged.activeMinutes ?? null,
    source: attribution,
  };
}

function buildPatientReported(log: DailyLog): PatientReported {
  return {
    energy: log.energy,
    pain: log.pain,
    nausea: log.nausea,
    mood: log.mood,
    appetite: log.appetite,
    neuropathy: log.neuropathy,
    notes: log.notes,
  };
}

// ==================== BASELINE ====================

function buildBaseline(allDaily: DailyLog[], allChemo: ChemoSession[], _db: unknown): BaselineData {
  // Priority: Phase C data from last 2 cycles > last 30 days > all data
  const phaseCLogs = allDaily.filter(d => d.chemoPhase === 'C');
  const last30 = allDaily.filter(d => {
    const diff = (Date.now() - new Date(d.date).getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 30;
  });

  const logs = phaseCLogs.length >= 5 ? phaseCLogs : last30.length >= 5 ? last30 : allDaily;
  const period = phaseCLogs.length >= 5 ? 'faza C (odbudowa)' : last30.length >= 5 ? 'ostatnie 30 dni' : 'wszystkie dane';

  return {
    period,
    rhr: null, // Would need wearable history
    sleepHours: avg(logs.filter(d => d.sleep).map(d => d.sleep!.hours)),
    hrv: null,
    steps: null,
    weight: avg(logs.filter(d => d.weight).map(d => d.weight!)),
    energy: avg(logs.map(d => d.energy)),
    spo2: null,
    bp: null,
  };
}

// ==================== HISTORICAL ====================

function buildHistoricalContext(allDaily: DailyLog[], allChemo: ChemoSession[], currentCycleDay: number | null): HistoricalContext | null {
  if (!currentCycleDay || currentCycleDay < 0 || allChemo.length < 2) return null;

  const sortedChemo = [...allChemo].sort((a, b) => (a.actualDate || a.date).localeCompare(b.actualDate || b.date));

  const entries: HistoricalContext['sameDayEntries'] = [];

  for (let i = 0; i < sortedChemo.length - 1; i++) {
    const chemoDate = new Date(sortedChemo[i].actualDate || sortedChemo[i].date);
    const targetDate = new Date(chemoDate);
    targetDate.setDate(chemoDate.getDate() + currentCycleDay);
    const dateStr = targetDate.toISOString().split('T')[0];

    const log = allDaily.find(d => d.date === dateStr);
    if (log) {
      entries.push({
        cycleNumber: i + 1,
        date: dateStr,
        energy: log.energy,
        pain: log.pain,
        nausea: log.nausea,
      });
    }
  }

  if (entries.length === 0) return null;

  const energies = entries.filter(e => e.energy !== undefined).map(e => e.energy!);
  const pains = entries.filter(e => e.pain !== undefined).map(e => e.pain!);
  const nauseas = entries.filter(e => e.nausea !== undefined).map(e => e.nausea!);

  const averages = energies.length >= 2 ? {
    energy: Math.round(avg(energies)! * 10) / 10,
    pain: Math.round(avg(pains)! * 10) / 10,
    nausea: Math.round(avg(nauseas)! * 10) / 10,
  } : null;

  const note = entries.length === 1
    ? `W poprzednim cyklu dzień ${currentCycleDay} wyglądał: energia ${entries[0].energy}/10`
    : `W ${entries.length} poprzednich cyklach dzień ${currentCycleDay}: energia ${energies.join(', ')}`;

  return { sameDayEntries: entries, averages, note };
}

// ==================== ALERTS ====================

function buildAlerts(device: DeviceDataSummary, recentBlood: BloodWork[]): ProfileAlert[] {
  const alerts: ProfileAlert[] = [];

  if (device.temperature && device.temperature >= 38.0) {
    alerts.push({
      type: 'critical',
      message: 'Temperatura ≥ 38°C — w trakcie chemioterapii może wskazywać na gorączkę neutropeniczną. Skontaktuj się z onkologiem.',
      value: `${device.temperature}°C`,
    });
  }

  if (device.spo2 && device.spo2 < 92) {
    alerts.push({
      type: 'critical',
      message: 'SpO2 < 92% — wymaga pilnej konsultacji medycznej.',
      value: `${device.spo2}%`,
    });
  }

  if (device.rhr && device.rhr > 120) {
    alerts.push({
      type: 'critical',
      message: 'RHR > 120 bpm — skontaktuj się z lekarzem.',
      value: `${device.rhr} bpm`,
    });
  }

  if (recentBlood.length > 0) {
    const latest = recentBlood[0];
    if (latest.markers.wbc !== undefined && latest.markers.wbc < 2.0) {
      alerts.push({ type: 'critical', message: 'WBC poniżej 2.0 — ryzyko infekcji. Kontakt z onkologiem.', value: `WBC ${latest.markers.wbc}` });
    }
    if (latest.markers.hgb !== undefined && latest.markers.hgb < 8.0) {
      alerts.push({ type: 'warning', message: 'Hemoglobina poniżej 8.0 g/dl — omów z lekarzem.', value: `Hgb ${latest.markers.hgb}` });
    }
  }

  return alerts;
}

// ==================== HELPERS ====================

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
