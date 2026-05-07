/*
 * Open Wearables adapter — bridges OW REST client to Dexie + Daily Profile.
 *
 * Architecture:
 * - syncOpenWearables() pulls 4 summary endpoints (activity/sleep/body/recovery),
 *   merges per (date, provider) into a unified WearableData row, and upserts
 *   into the existing `wearable` table with source='open_wearables'. No Dexie
 *   schema bump — the existing table is the multi-source store.
 * - getMergedDailyData() is the read interface for Daily Profile / Hydration.
 *   It walks the existing wearable rows for a date and applies the priority
 *   chain: withings_direct (OAuth) > open_wearables > csv > manual.
 *
 * Provider quality priority (when multiple OW providers report the same day):
 *   oura > whoop > ultrahuman > garmin > polar > suunto > strava
 * Roughly mirrors medical-grade reputation in the wearables industry.
 *
 * Idempotency: WearableData.id = `ow_{date}_{provider}` so re-syncing the
 * same window upserts (no duplicates).
 */

import { db } from './db';
import { openWearablesClient } from './openwearables-client';
import {
  OpenWearablesNotConfiguredError,
  type OWActivitySummary,
  type OWBodySummary,
  type OWRecoverySummary,
  type OWSleepSummary,
  type OpenWearablesProvider,
} from '@/types/openwearables';
import type { WearableData } from '@/types';

export interface SyncResult {
  success: boolean;
  syncedDays: number;
  providers: OpenWearablesProvider[];
  errors: string[];
}

const PROVIDER_PRIORITY: Record<OpenWearablesProvider, number> = {
  oura: 7,
  whoop: 6,
  ultrahuman: 5,
  garmin: 4,
  polar: 3,
  suunto: 2,
  strava: 1,
};

/** Highest-quality provider when multiple appear on the same day. */
function pickProvider(providers: OpenWearablesProvider[]): OpenWearablesProvider {
  return providers.reduce((best, current) =>
    PROVIDER_PRIORITY[current] > PROVIDER_PRIORITY[best] ? current : best
  );
}

/** Fold the 4 summary streams into a per-(date, provider) bucket. */
interface DayBucket {
  date: string;
  provider: OpenWearablesProvider;
  activity?: OWActivitySummary;
  sleep?: OWSleepSummary;
  body?: OWBodySummary;
  recovery?: OWRecoverySummary;
}

function bucketize(
  activity: OWActivitySummary[],
  sleep: OWSleepSummary[],
  body: OWBodySummary[],
  recovery: OWRecoverySummary[]
): Map<string, DayBucket> {
  const buckets = new Map<string, DayBucket>();
  const ensure = (date: string, provider: OpenWearablesProvider): DayBucket => {
    const key = `${date}|${provider}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { date, provider };
      buckets.set(key, bucket);
    }
    return bucket;
  };
  for (const a of activity) ensure(a.date, a.source).activity = a;
  for (const s of sleep) ensure(s.date, s.source).sleep = s;
  for (const b of body) ensure(b.date, b.source).body = b;
  for (const r of recovery) ensure(r.date, r.source).recovery = r;
  return buckets;
}

/** Convert a per-(date, provider) bucket into a WearableData row. */
function bucketToWearable(bucket: DayBucket): WearableData {
  const sleep = bucket.sleep;
  const recovery = bucket.recovery;
  const activity = bucket.activity;
  return {
    id: `ow_${bucket.date}_${bucket.provider}`,
    date: bucket.date,
    source: 'open_wearables',
    provider: bucket.provider,
    rhr: recovery?.restingHeartRate ?? 0,
    hrv: recovery?.hrvMs ?? 0,
    spo2: recovery?.spo2Percent ?? 0,
    sleepHours: sleep?.durationMinutes !== undefined ? sleep.durationMinutes / 60 : 0,
    deepSleep: sleep?.deepMinutes !== undefined ? sleep.deepMinutes / 60 : 0,
    remSleep: sleep?.remMinutes !== undefined ? sleep.remMinutes / 60 : 0,
    lightSleep: sleep?.lightMinutes !== undefined ? sleep.lightMinutes / 60 : 0,
    steps: activity?.steps ?? 0,
    activeMinutes: activity?.activeMinutes ?? 0,
    biocharge: 0,
    skinTemperature: recovery?.skinTemperatureDelta,
  };
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * Pull last `daysBack` days from Open Wearables and persist into the
 * existing wearable table. Idempotent — second call upserts.
 */
export async function syncOpenWearables(daysBack: number = 7): Promise<SyncResult> {
  if (!(await openWearablesClient.isConfigured())) {
    return { success: false, syncedDays: 0, providers: [], errors: ['not_configured'] };
  }
  const errors: string[] = [];
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - (daysBack - 1));
  const startStr = isoDate(start);
  const endStr = isoDate(today);

  let activity: OWActivitySummary[] = [];
  let sleep: OWSleepSummary[] = [];
  let body: OWBodySummary[] = [];
  let recovery: OWRecoverySummary[] = [];

  try {
    [activity, sleep, body, recovery] = await Promise.all([
      openWearablesClient.getActivity(startStr, endStr).catch((e) => {
        errors.push(`activity: ${(e as Error).message}`);
        return [] as OWActivitySummary[];
      }),
      openWearablesClient.getSleep(startStr, endStr).catch((e) => {
        errors.push(`sleep: ${(e as Error).message}`);
        return [] as OWSleepSummary[];
      }),
      openWearablesClient.getBody(startStr, endStr).catch((e) => {
        errors.push(`body: ${(e as Error).message}`);
        return [] as OWBodySummary[];
      }),
      openWearablesClient.getRecovery(startStr, endStr).catch((e) => {
        errors.push(`recovery: ${(e as Error).message}`);
        return [] as OWRecoverySummary[];
      }),
    ]);
  } catch (err) {
    if (err instanceof OpenWearablesNotConfiguredError) {
      return { success: false, syncedDays: 0, providers: [], errors: ['not_configured'] };
    }
    errors.push((err as Error).message);
  }

  const buckets = bucketize(activity, sleep, body, recovery);
  const rows: WearableData[] = [];
  const providers = new Set<OpenWearablesProvider>();
  for (const bucket of buckets.values()) {
    rows.push(bucketToWearable(bucket));
    providers.add(bucket.provider);
  }

  if (rows.length > 0) {
    await db.wearable.bulkPut(rows);
  }

  return {
    success: errors.length === 0,
    syncedDays: rows.length,
    providers: Array.from(providers),
    errors,
  };
}

/** Source returned by getMergedDailyData. */
export type MergedSource = 'withings_direct' | 'open_wearables' | 'csv' | 'manual' | 'none';

export interface MergedDailyData {
  date: string;
  source: MergedSource;
  /** Provider name for source attribution UI ('oura', 'whoop', etc. or 'withings'). */
  attribution?: string;
  rhr?: number;
  hrv?: number;
  spo2?: number;
  skinTemperature?: number;
  sleepHours?: number;
  deepSleep?: number;
  remSleep?: number;
  bodyWaterMass?: number;
  weight?: number;
  electrochemicalSkinConductance?: WearableData['electrochemicalSkinConductance'];
  visceralFat?: number;
}

const NON_ZERO = (n: number | undefined): n is number => typeof n === 'number' && n > 0;

/**
 * Pick highest-priority value across rows for each metric.
 * Rows already pre-sorted by priority.
 */
function pickFirst<T>(rows: WearableData[], pick: (r: WearableData) => T | undefined): T | undefined {
  for (const r of rows) {
    const v = pick(r);
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

/**
 * Read merged daily data with priority:
 *   1. Withings direct (OAuth — has accessToken in deviceConnections)
 *   2. Open Wearables
 *   3. CSV import (Withings CSV / Garmin CSV)
 *   4. Manual DailyLog
 *
 * Each metric is filled from the highest-priority row that has a value.
 */
export async function getMergedDailyData(date: string): Promise<MergedDailyData> {
  const dayRows = await db.wearable.where('date').equals(date).toArray();

  const withingsOAuth = dayRows.filter((r) => r.source === 'withings');
  const ow = dayRows.filter((r) => r.source === 'open_wearables');
  const csv = dayRows.filter((r) => r.source === 'csv_import' || r.source === 'garmin');

  const sortedOw = [...ow].sort(
    (a, b) =>
      (PROVIDER_PRIORITY[b.provider as OpenWearablesProvider] ?? 0) -
      (PROVIDER_PRIORITY[a.provider as OpenWearablesProvider] ?? 0)
  );

  const allOrdered = [...withingsOAuth, ...sortedOw, ...csv];

  const dailyLog = await db.daily.where('date').equals(date).first();

  let source: MergedSource = 'none';
  let attribution: string | undefined;
  if (withingsOAuth.length > 0) {
    source = 'withings_direct';
    attribution = 'withings';
  } else if (ow.length > 0) {
    source = 'open_wearables';
    attribution = sortedOw[0]?.provider;
  } else if (csv.length > 0) {
    source = 'csv';
    attribution = csv[0]?.source;
  } else if (dailyLog) {
    source = 'manual';
  }

  if (source === 'none') return { date, source: 'none' };

  return {
    date,
    source,
    attribution,
    rhr: pickFirst(allOrdered, (r) => (NON_ZERO(r.rhr) ? r.rhr : undefined)) ?? dailyLog?.heartRate,
    hrv: pickFirst(allOrdered, (r) => (NON_ZERO(r.hrv) ? r.hrv : undefined)),
    spo2: pickFirst(allOrdered, (r) => (NON_ZERO(r.spo2) ? r.spo2 : undefined)),
    skinTemperature: pickFirst(allOrdered, (r) => r.skinTemperature),
    sleepHours:
      pickFirst(allOrdered, (r) => (NON_ZERO(r.sleepHours) ? r.sleepHours : undefined)) ??
      dailyLog?.sleep?.hours,
    deepSleep: pickFirst(allOrdered, (r) => (NON_ZERO(r.deepSleep) ? r.deepSleep : undefined)),
    remSleep: pickFirst(allOrdered, (r) => (NON_ZERO(r.remSleep) ? r.remSleep : undefined)),
    weight: dailyLog?.weight,
    electrochemicalSkinConductance: pickFirst(
      allOrdered,
      (r) => r.electrochemicalSkinConductance
    ),
    visceralFat: pickFirst(allOrdered, (r) => r.visceralFat),
  };
}

// Exported for tests
export const _internal = {
  PROVIDER_PRIORITY,
  pickProvider,
  bucketize,
  bucketToWearable,
};
