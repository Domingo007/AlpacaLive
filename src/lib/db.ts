/*
 * AlpacaLive — Your Companion Through Cancer Treatment
 * Copyright (C) 2025 AlpacaLive Contributors
 * Licensed under AGPL-3.0 — see LICENSE file
 */
import Dexie, { type Table } from 'dexie';
import {
  DEFAULT_NOTIFICATIONS,
} from '@/types';
import type {
  PatientProfile,
  ChemoSession,
  BloodWork,
  DailyLog,
  WearableData,
  MealLog,
  SupplementLog,
  ImagingStudy,
  PatternSummary,
  ChatMessage,
  AppSettings,
  CalendarNote,
  TreatmentSession,
} from '@/types';
import type { DeviceConnection } from './devices/types';
import type { AIAuditLogEntry } from '@/types/audit-log';

export interface ReferenceDataRecord {
  id: string;
  type: 'blood_norms' | 'cyp450' | 'disease_profiles';
  version: string;
  lastUpdated: string;
  sourceUrl?: string;
  data: unknown;
}

class AlpacaLiveDB extends Dexie {
  patient!: Table<PatientProfile>;
  chemo!: Table<ChemoSession>;
  blood!: Table<BloodWork>;
  daily!: Table<DailyLog>;
  wearable!: Table<WearableData>;
  meals!: Table<MealLog>;
  supplements!: Table<SupplementLog>;
  imaging!: Table<ImagingStudy>;
  patternSummaries!: Table<PatternSummary>;
  chat!: Table<ChatMessage>;
  settings!: Table<AppSettings>;
  calendarNotes!: Table<CalendarNote>;
  treatmentSessions!: Table<TreatmentSession>;
  referenceData!: Table<ReferenceDataRecord>;
  deviceConnections!: Table<DeviceConnection>;
  aiAuditLog!: Table<AIAuditLogEntry>;

  constructor() {
    super('AlpacaLiveDB');
    this.version(1).stores({
      patient: 'id',
      chemo: 'id, date, plannedDate, status',
      blood: 'id, date',
      daily: 'id, date',
      wearable: 'id, date',
      meals: 'id, date',
      supplements: 'id, date',
      imaging: 'id, date, type',
      predictions: 'id, date, targetDate, type',
      chat: 'id, timestamp',
      settings: 'id',
      calendarNotes: 'id, date, type',
    });

    // Version 2: add treatmentSessions and referenceData tables
    this.version(2).stores({
      patient: 'id',
      chemo: 'id, date, plannedDate, status',
      blood: 'id, date',
      daily: 'id, date',
      wearable: 'id, date',
      meals: 'id, date',
      supplements: 'id, date',
      imaging: 'id, date, type',
      predictions: 'id, date, targetDate, type',
      chat: 'id, timestamp',
      settings: 'id',
      calendarNotes: 'id, date, type',
      treatmentSessions: 'id, date, treatmentType, status',
      referenceData: 'id, type, version',
    });

    // Version 3: add deviceConnections table
    this.version(3).stores({
      patient: 'id',
      chemo: 'id, date, plannedDate, status',
      blood: 'id, date',
      daily: 'id, date',
      wearable: 'id, date',
      meals: 'id, date',
      supplements: 'id, date',
      imaging: 'id, date, type',
      predictions: 'id, date, targetDate, type',
      chat: 'id, timestamp',
      settings: 'id',
      calendarNotes: 'id, date, type',
      treatmentSessions: 'id, date, treatmentType, status',
      referenceData: 'id, type, version',
      deviceConnections: 'id',
    });

    // Version 4: rename table 'predictions' → 'patternSummaries'
    this.version(4).stores({
      predictions: null,
      patternSummaries: 'id, date, targetDate, type',
    }).upgrade(async tx => {
      const oldRecords = await tx.table('predictions').toArray();
      if (oldRecords.length > 0) {
        await tx.table('patternSummaries').bulkAdd(oldRecords);
      }
    });

    // Version 5: add aiAuditLog table
    this.version(5).stores({
      patient: 'id',
      chemo: 'id, date, plannedDate, status',
      blood: 'id, date',
      daily: 'id, date',
      wearable: 'id, date',
      meals: 'id, date',
      supplements: 'id, date',
      imaging: 'id, date, type',
      predictions: null,
      patternSummaries: 'id, date, targetDate, type',
      chat: 'id, timestamp',
      settings: 'id',
      calendarNotes: 'id, date, type',
      treatmentSessions: 'id, date, treatmentType, status',
      referenceData: 'id, type, version',
      deviceConnections: 'id',
      aiAuditLog: '++id, timestamp, provider, success',
    });
  }
}

// ==================== DUAL DATABASE SYSTEM ====================
// Two separate IndexedDB databases:
// - AlpacaLiveDB: real user data (never touched by demo)
// - AlpacaLiveDemoDB: demo data (created/deleted on demand)
// The exported `db` always points to the currently active database.

const DEMO_DB_NAME = 'AlpacaLiveDemoDB';
const DEMO_FLAG_KEY = 'alpacalive_demo_active';

class AlpacaLiveDemoDB extends Dexie {
  patient!: Table<PatientProfile>;
  chemo!: Table<ChemoSession>;
  blood!: Table<BloodWork>;
  daily!: Table<DailyLog>;
  wearable!: Table<WearableData>;
  meals!: Table<MealLog>;
  supplements!: Table<SupplementLog>;
  imaging!: Table<ImagingStudy>;
  patternSummaries!: Table<PatternSummary>;
  chat!: Table<ChatMessage>;
  settings!: Table<AppSettings>;
  calendarNotes!: Table<CalendarNote>;
  treatmentSessions!: Table<TreatmentSession>;
  referenceData!: Table<ReferenceDataRecord>;
  deviceConnections!: Table<DeviceConnection>;
  aiAuditLog!: Table<AIAuditLogEntry>;

  constructor() {
    super(DEMO_DB_NAME);
    this.version(1).stores({
      patient: 'id',
      chemo: 'id, date, plannedDate, status',
      blood: 'id, date',
      daily: 'id, date',
      wearable: 'id, date',
      meals: 'id, date',
      supplements: 'id, date',
      imaging: 'id, date, type',
      predictions: 'id, date, targetDate, type',
      chat: 'id, timestamp',
      settings: 'id',
      calendarNotes: 'id, date, type',
      treatmentSessions: 'id, date, treatmentType, status',
      referenceData: 'id, type, version',
      deviceConnections: 'id',
    });

    // Version 4: rename table 'predictions' → 'patternSummaries' (matches AlpacaLiveDB)
    this.version(4).stores({
      predictions: null,
      patternSummaries: 'id, date, targetDate, type',
    }).upgrade(async tx => {
      const oldRecords = await tx.table('predictions').toArray();
      if (oldRecords.length > 0) {
        await tx.table('patternSummaries').bulkAdd(oldRecords);
      }
    });

    // Version 5: add aiAuditLog table
    this.version(5).stores({
      patient: 'id',
      chemo: 'id, date, plannedDate, status',
      blood: 'id, date',
      daily: 'id, date',
      wearable: 'id, date',
      meals: 'id, date',
      supplements: 'id, date',
      imaging: 'id, date, type',
      predictions: null,
      patternSummaries: 'id, date, targetDate, type',
      chat: 'id, timestamp',
      settings: 'id',
      calendarNotes: 'id, date, type',
      treatmentSessions: 'id, date, treatmentType, status',
      referenceData: 'id, type, version',
      deviceConnections: 'id',
      aiAuditLog: '++id, timestamp, provider, success',
    });
  }
}

const userDb = new AlpacaLiveDB();
let demoDb: AlpacaLiveDemoDB | null = null;

function isDemoActive(): boolean {
  try {
    return localStorage.getItem(DEMO_FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

function getDemoDb(): AlpacaLiveDemoDB {
  if (!demoDb) demoDb = new AlpacaLiveDemoDB();
  return demoDb;
}

/** The active database — all app code uses this. */
export let db: AlpacaLiveDB | AlpacaLiveDemoDB = isDemoActive() ? getDemoDb() : userDb;

/** Switch to demo database. */
export function activateDemoDb(): void {
  localStorage.setItem(DEMO_FLAG_KEY, 'true');
  db = getDemoDb();
}

/** Switch back to user database and delete demo DB. */
export async function deactivateDemoDb(): Promise<void> {
  localStorage.removeItem(DEMO_FLAG_KEY);
  db = userDb;
  // Close and delete demo database entirely
  if (demoDb) {
    demoDb.close();
    demoDb = null;
  }
  await Dexie.delete(DEMO_DB_NAME);
}

export async function getSettings(): Promise<AppSettings | undefined> {
  return db.settings.get('main');
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const existing = await getSettings();
  if (existing) {
    await db.settings.update('main', settings);
  } else {
    await db.settings.put({ id: 'main', apiKey: '', aiProvider: 'anthropic', appMode: 'notebook', theme: 'light', language: 'en', onboardingCompleted: false, notifications: DEFAULT_NOTIFICATIONS, ...settings } as AppSettings & { id: string });
  }
}

export async function getPatient(): Promise<PatientProfile | undefined> {
  const patients = await db.patient.toArray();
  return patients[0];
}

export async function savePatient(patient: PatientProfile): Promise<void> {
  await db.patient.put(patient);
}

export async function getRecentDailyLogs(count = 5): Promise<DailyLog[]> {
  return db.daily.orderBy('date').reverse().limit(count).toArray();
}

export async function getRecentBloodWork(count = 2): Promise<BloodWork[]> {
  return db.blood.orderBy('date').reverse().limit(count).toArray();
}

export async function getRecentWearableData(count = 5): Promise<WearableData[]> {
  return db.wearable.orderBy('date').reverse().limit(count).toArray();
}

export async function getRecentMeals(count = 15): Promise<MealLog[]> {
  return db.meals.orderBy('date').reverse().limit(count).toArray();
}

export async function getRecentChemo(count = 6): Promise<ChemoSession[]> {
  return db.chemo.orderBy('date').reverse().limit(count).toArray();
}

export async function getRecentSupplements(count = 7): Promise<SupplementLog[]> {
  return db.supplements.orderBy('date').reverse().limit(count).toArray();
}

export async function getRecentImaging(count = 2): Promise<ImagingStudy[]> {
  return db.imaging.orderBy('date').reverse().limit(count).toArray();
}

export async function getRecentPredictions(count = 3): Promise<PatternSummary[]> {
  return db.patternSummaries.orderBy('date').reverse().limit(count).toArray();
}

export async function getChatMessages(count = 50): Promise<ChatMessage[]> {
  return db.chat.orderBy('timestamp').reverse().limit(count).toArray().then(msgs => msgs.reverse());
}

export async function addChatMessage(message: ChatMessage): Promise<void> {
  await db.chat.add(message);
}

export async function updateChatMessage(message: ChatMessage): Promise<void> {
  await db.chat.put(message);
}

export async function getRecentTreatmentSessions(count = 10): Promise<TreatmentSession[]> {
  return db.treatmentSessions.orderBy('date').reverse().limit(count).toArray();
}

export async function getTreatmentSessionsByType(type: string): Promise<TreatmentSession[]> {
  return db.treatmentSessions.where('treatmentType').equals(type).toArray();
}

export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.patient.clear(),
    db.chemo.clear(),
    db.blood.clear(),
    db.daily.clear(),
    db.wearable.clear(),
    db.meals.clear(),
    db.supplements.clear(),
    db.imaging.clear(),
    db.patternSummaries.clear(),
    db.chat.clear(),
    db.settings.clear(),
    db.calendarNotes.clear(),
    db.treatmentSessions.clear(),
    db.referenceData.clear(),
    db.deviceConnections.clear(),
  ]);
}

export async function exportAllData(): Promise<string> {
  const data = {
    patient: await db.patient.toArray(),
    chemo: await db.chemo.toArray(),
    blood: await db.blood.toArray(),
    daily: await db.daily.toArray(),
    wearable: await db.wearable.toArray(),
    meals: await db.meals.toArray(),
    supplements: await db.supplements.toArray(),
    imaging: await db.imaging.toArray(),
    patternSummaries: await db.patternSummaries.toArray(),
    chat: await db.chat.toArray(),
    settings: await db.settings.toArray(),
    treatmentSessions: await db.treatmentSessions.toArray(),
    calendarNotes: await db.calendarNotes.toArray(),
    exportDate: new Date().toISOString(),
    version: '2.0',
  };
  return JSON.stringify(data, null, 2);
}

export async function importData(jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString);
  await clearAllData();
  if (data.patient) await db.patient.bulkPut(data.patient);
  if (data.chemo) await db.chemo.bulkPut(data.chemo);
  if (data.blood) await db.blood.bulkPut(data.blood);
  if (data.daily) await db.daily.bulkPut(data.daily);
  if (data.wearable) await db.wearable.bulkPut(data.wearable);
  if (data.meals) await db.meals.bulkPut(data.meals);
  if (data.supplements) await db.supplements.bulkPut(data.supplements);
  if (data.imaging) await db.imaging.bulkPut(data.imaging);
  if (data.patternSummaries) await db.patternSummaries.bulkPut(data.patternSummaries);
  if (data.chat) await db.chat.bulkPut(data.chat);
  if (data.settings) await db.settings.bulkPut(data.settings);
  if (data.treatmentSessions) await db.treatmentSessions.bulkPut(data.treatmentSessions);
  if (data.calendarNotes) await db.calendarNotes.bulkPut(data.calendarNotes);
}

export async function pruneAuditLog(keepDays = 90): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - keepDays);
  await db.aiAuditLog.where('timestamp').below(cutoff).delete();
}
