/*
 * Oura adapter — pulls daily sleep/readiness/activity/spo2 from the Oura
 * v2 API and writes them into the existing `wearable` Dexie table with
 * source='open_wearables' and provider='oura'. We re-use the OW source
 * label so the priority chain in openwearables-adapter (Oura > Garmin
 * > ...) and the source-attribution UI keep working without a new code
 * path. From the data layer's POV, "Oura via PAT" and "Oura via Open
 * Wearables backend" produce equivalent rows.
 */

import { db } from './db';
import { ouraClient } from './oura-client';
import type { WearableData } from '@/types';

export interface OuraSyncResult {
  success: boolean;
  syncedDays: number;
  errors: string[];
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export async function syncOura(daysBack = 7): Promise<OuraSyncResult> {
  if (!(await ouraClient.isConfigured())) {
    return { success: false, syncedDays: 0, errors: ['not_configured'] };
  }
  const errors: string[] = [];
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - (daysBack - 1));
  const startStr = isoDate(start);
  const endStr = isoDate(today);

  const [sleepDaily, sleepSessions, readiness, activity, spo2] = await Promise.all([
    ouraClient.getDailySleep(startStr, endStr).catch(e => {
      errors.push(`daily_sleep: ${(e as Error).message}`);
      return [];
    }),
    ouraClient.getSleepSessions(startStr, endStr).catch(e => {
      errors.push(`sleep: ${(e as Error).message}`);
      return [];
    }),
    ouraClient.getDailyReadiness(startStr, endStr).catch(e => {
      errors.push(`daily_readiness: ${(e as Error).message}`);
      return [];
    }),
    ouraClient.getDailyActivity(startStr, endStr).catch(e => {
      errors.push(`daily_activity: ${(e as Error).message}`);
      return [];
    }),
    ouraClient.getDailySpO2(startStr, endStr).catch(e => {
      errors.push(`daily_spo2: ${(e as Error).message}`);
      return [];
    }),
  ]);

  // Index by date — Oura sleep sessions can have multiple per day (nap + main),
  // pick the longest one for the daily row.
  const sessionByDate = new Map<string, typeof sleepSessions[number]>();
  for (const s of sleepSessions) {
    const existing = sessionByDate.get(s.day);
    const dur = s.total_sleep_duration ?? 0;
    if (!existing || (existing.total_sleep_duration ?? 0) < dur) {
      sessionByDate.set(s.day, s);
    }
  }
  const sleepDailyByDate = new Map(sleepDaily.map(s => [s.day, s]));
  const readinessByDate = new Map(readiness.map(r => [r.day, r]));
  const activityByDate = new Map(activity.map(a => [a.day, a]));
  const spo2ByDate = new Map(spo2.map(s => [s.day, s]));

  const allDates = new Set<string>([
    ...sleepDailyByDate.keys(),
    ...sessionByDate.keys(),
    ...readinessByDate.keys(),
    ...activityByDate.keys(),
    ...spo2ByDate.keys(),
  ]);

  const rows: WearableData[] = [];
  for (const date of allDates) {
    const sess = sessionByDate.get(date);
    const act = activityByDate.get(date);
    const sp = spo2ByDate.get(date);
    rows.push({
      id: `ow_${date}_oura`,
      date,
      source: 'open_wearables',
      provider: 'oura',
      rhr: sess?.lowest_heart_rate ?? sess?.average_heart_rate ?? 0,
      hrv: sess?.average_hrv ?? 0,
      spo2: sp?.spo2_percentage?.average ?? 0,
      sleepHours: sess?.total_sleep_duration ? sess.total_sleep_duration / 3600 : 0,
      deepSleep: sess?.deep_sleep_duration ? sess.deep_sleep_duration / 3600 : 0,
      remSleep: sess?.rem_sleep_duration ? sess.rem_sleep_duration / 3600 : 0,
      lightSleep: sess?.light_sleep_duration ? sess.light_sleep_duration / 3600 : 0,
      steps: act?.steps ?? 0,
      activeMinutes: act ? Math.round((act.high_activity_time ?? 0) / 60 + (act.medium_activity_time ?? 0) / 60) : 0,
      biocharge: 0,
    });
  }

  if (rows.length > 0) {
    await db.wearable.bulkPut(rows);
  }

  return { success: errors.length === 0, syncedDays: rows.length, errors };
}
