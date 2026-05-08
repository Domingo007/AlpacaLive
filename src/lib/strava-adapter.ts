/*
 * Strava adapter — pulls activities from the Strava v3 API and aggregates
 * per-day into the existing wearable table with source='open_wearables'
 * and provider='strava'. Strava is workout-centric; we collapse all
 * activities of one day into a single row recording total active minutes,
 * total distance and average heart rate weighted by duration.
 *
 * Strava does not provide RHR / sleep / SpO2, so those fields stay 0.
 * Steps come from the activity moving_time when available (rough proxy).
 */

import { db } from './db';
import {
  StravaAuthError,
  getActivities,
  isStravaConfigured,
  loadTokens,
  type StravaActivity,
} from './strava-client';
import type { WearableData } from '@/types';

export interface StravaSyncResult {
  success: boolean;
  syncedDays: number;
  errors: string[];
}

function isoDate(d: Date | string): string {
  return new Date(d).toISOString().split('T')[0];
}

interface DayBucket {
  date: string;
  totalMovingSec: number;
  weightedHrSum: number; // average_hr * moving_time
  weightedHrWeight: number; // total moving_time when avg_hr present
  maxHr: number;
}

function bucketize(activities: StravaActivity[]): Map<string, DayBucket> {
  const days = new Map<string, DayBucket>();
  for (const a of activities) {
    const date = isoDate(a.start_date_local || a.start_date);
    let bucket = days.get(date);
    if (!bucket) {
      bucket = { date, totalMovingSec: 0, weightedHrSum: 0, weightedHrWeight: 0, maxHr: 0 };
      days.set(date, bucket);
    }
    const moving = a.moving_time ?? 0;
    bucket.totalMovingSec += moving;
    if (a.average_heartrate && moving > 0) {
      bucket.weightedHrSum += a.average_heartrate * moving;
      bucket.weightedHrWeight += moving;
    }
    if (a.max_heartrate && a.max_heartrate > bucket.maxHr) {
      bucket.maxHr = a.max_heartrate;
    }
  }
  return days;
}

function bucketToWearable(bucket: DayBucket): WearableData {
  const avgHr = bucket.weightedHrWeight > 0
    ? Math.round(bucket.weightedHrSum / bucket.weightedHrWeight)
    : 0;
  return {
    id: `ow_${bucket.date}_strava`,
    date: bucket.date,
    source: 'open_wearables',
    provider: 'strava',
    rhr: 0, // Strava doesn't report RHR
    hrv: 0,
    spo2: 0,
    sleepHours: 0,
    deepSleep: 0,
    remSleep: 0,
    lightSleep: 0,
    steps: 0, // Strava doesn't report steps
    activeMinutes: Math.round(bucket.totalMovingSec / 60),
    biocharge: 0,
    skinTemperature: undefined,
    // Save weighted-average activity HR as a custom metric — surfaces in
    // pattern engine as the only Strava-provided HR signal.
    respiratoryRate: avgHr || undefined,
  };
}

export async function syncStrava(daysBack = 7): Promise<StravaSyncResult> {
  if (!(await isStravaConfigured())) {
    return { success: false, syncedDays: 0, errors: ['not_configured'] };
  }
  if (!(await loadTokens())) {
    return { success: false, syncedDays: 0, errors: ['not_authorized'] };
  }
  const errors: string[] = [];
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - (daysBack - 1));
  const afterUnix = Math.floor(start.getTime() / 1000);
  const beforeUnix = Math.floor(today.getTime() / 1000);

  let activities: StravaActivity[] = [];
  try {
    activities = await getActivities(afterUnix, beforeUnix);
  } catch (err) {
    if (err instanceof StravaAuthError) {
      errors.push(`auth: ${err.message}`);
    } else {
      errors.push(`activities: ${(err as Error).message}`);
    }
  }

  const buckets = bucketize(activities);
  const rows: WearableData[] = [];
  for (const bucket of buckets.values()) {
    rows.push(bucketToWearable(bucket));
  }

  if (rows.length > 0) {
    await db.wearable.bulkPut(rows);
  }

  return { success: errors.length === 0, syncedDays: rows.length, errors };
}

export const _internal = { bucketize, bucketToWearable };
