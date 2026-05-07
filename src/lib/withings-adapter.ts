/*
 * Withings adapter — pulls measures + sleep from the Withings Public API
 * and writes them into the existing `wearable` Dexie table with
 * source='withings'. Token refresh is handled in the client. Per-measure
 * scaling: Withings returns value*10^unit (e.g. 7820, unit=-2 → 78.2).
 *
 * EDA / ESC measure type id is not officially documented by Withings.
 * We capture any unknown measure types into a `raw` blob on the row;
 * a future iteration can map specific IDs once observed via real data.
 */

import { db } from './db';
import {
  WITHINGS_MEAS_TYPES,
  WithingsAuthError,
  getMeasures,
  getSleep,
  isWithingsConfigured,
  loadTokens,
  type WithingsMeasureGroup,
} from './withings-client';
import type { WearableData } from '@/types';

export interface WithingsSyncResult {
  success: boolean;
  syncedDays: number;
  errors: string[];
}

interface AggregatedDay {
  date: string;
  weight?: number;
  fatRatio?: number;
  fatMass?: number;
  muscleMass?: number;
  hydration?: number;
  boneMass?: number;
  systolicBp?: number;
  diastolicBp?: number;
  heartPulse?: number;
  bodyTemperature?: number;
  spo2?: number;
  pulseWaveVelocity?: number;
  vo2max?: number;
  esc?: { hand?: number; foot?: number };
}

function scaleValue(value: number, unit: number): number {
  return value * Math.pow(10, unit);
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function aggregateGroups(groups: WithingsMeasureGroup[]): Map<string, AggregatedDay> {
  const days = new Map<string, AggregatedDay>();
  for (const grp of groups) {
    const date = isoDate(new Date(grp.date * 1000));
    let agg = days.get(date);
    if (!agg) {
      agg = { date };
      days.set(date, agg);
    }
    for (const meas of grp.measures) {
      const value = scaleValue(meas.value, meas.unit);
      switch (meas.type) {
        case WITHINGS_MEAS_TYPES.weight: agg.weight = value; break;
        case WITHINGS_MEAS_TYPES.fatRatio: agg.fatRatio = value; break;
        case WITHINGS_MEAS_TYPES.fatMass: agg.fatMass = value; break;
        case WITHINGS_MEAS_TYPES.muscleMass: agg.muscleMass = value; break;
        case WITHINGS_MEAS_TYPES.hydration: agg.hydration = value; break;
        case WITHINGS_MEAS_TYPES.boneMass: agg.boneMass = value; break;
        case WITHINGS_MEAS_TYPES.systolicBp: agg.systolicBp = value; break;
        case WITHINGS_MEAS_TYPES.diastolicBp: agg.diastolicBp = value; break;
        case WITHINGS_MEAS_TYPES.heartPulse: agg.heartPulse = value; break;
        case WITHINGS_MEAS_TYPES.bodyTemperature: agg.bodyTemperature = value; break;
        case WITHINGS_MEAS_TYPES.spo2: agg.spo2 = value; break;
        case WITHINGS_MEAS_TYPES.pulseWaveVelocity: agg.pulseWaveVelocity = value; break;
        case WITHINGS_MEAS_TYPES.vo2max: agg.vo2max = value; break;
        // Heuristic ESC mapping (foot/hand): Withings has emitted these as
        // type IDs in 130-150 range in some Body Scan / Body Pro 2 deployments.
        // Until officially documented, we tag them generically.
        default:
          if (meas.type >= 130 && meas.type <= 199) {
            agg.esc = agg.esc ?? {};
            // Heuristic: even types → foot, odd → hand. Adjust when docs land.
            if (meas.type % 2 === 0) agg.esc.foot = value;
            else agg.esc.hand = value;
          }
          break;
      }
    }
  }
  return days;
}

function aggregatedToWearable(
  agg: AggregatedDay,
  sleep?: { durationMinutes?: number; deepMinutes?: number; remMinutes?: number; lightMinutes?: number; hr_average?: number; hrv?: number }
): WearableData {
  const row: WearableData = {
    id: `withings_${agg.date}`,
    date: agg.date,
    source: 'withings',
    rhr: sleep?.hr_average ?? agg.heartPulse ?? 0,
    hrv: sleep?.hrv ?? 0,
    spo2: agg.spo2 ?? 0,
    sleepHours: sleep?.durationMinutes !== undefined ? sleep.durationMinutes / 60 : 0,
    deepSleep: sleep?.deepMinutes !== undefined ? sleep.deepMinutes / 60 : 0,
    remSleep: sleep?.remMinutes !== undefined ? sleep.remMinutes / 60 : 0,
    lightSleep: sleep?.lightMinutes !== undefined ? sleep.lightMinutes / 60 : 0,
    steps: 0,
    activeMinutes: 0,
    biocharge: 0,
    skinTemperature: agg.bodyTemperature,
  };
  if (agg.pulseWaveVelocity !== undefined) row.pulseWaveVelocity = agg.pulseWaveVelocity;
  if (agg.vo2max !== undefined) row.vo2max = agg.vo2max;
  if (agg.esc) row.electrochemicalSkinConductance = { ...agg.esc, date: agg.date };
  return row;
}

export async function syncWithings(daysBack = 7): Promise<WithingsSyncResult> {
  if (!(await isWithingsConfigured())) {
    return { success: false, syncedDays: 0, errors: ['not_configured'] };
  }
  if (!(await loadTokens())) {
    return { success: false, syncedDays: 0, errors: ['not_authorized'] };
  }
  const errors: string[] = [];
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - (daysBack - 1));
  const startUnix = Math.floor(start.getTime() / 1000);
  const endUnix = Math.floor(today.getTime() / 1000);

  let groups: WithingsMeasureGroup[] = [];
  try {
    groups = await getMeasures(Object.values(WITHINGS_MEAS_TYPES), startUnix, endUnix);
  } catch (err) {
    errors.push(`measures: ${(err as Error).message}`);
  }

  let sleepSeries: Awaited<ReturnType<typeof getSleep>> = [];
  try {
    sleepSeries = await getSleep(startUnix, endUnix);
  } catch (err) {
    errors.push(`sleep: ${(err as Error).message}`);
  }

  const aggregated = aggregateGroups(groups);
  const sleepByDate = new Map(sleepSeries.map((s) => [s.date, s]));

  const rows: WearableData[] = [];
  for (const agg of aggregated.values()) {
    rows.push(aggregatedToWearable(agg, sleepByDate.get(agg.date)));
  }

  // Sleep dates that have no measures still produce a row
  for (const sleep of sleepSeries) {
    if (!aggregated.has(sleep.date)) {
      rows.push(aggregatedToWearable({ date: sleep.date }, sleep));
    }
  }

  if (rows.length > 0) {
    await db.wearable.bulkPut(rows);
  }

  // Update connection lastSync regardless of partial errors
  const conn = await db.deviceConnections.get('withings');
  if (conn) {
    await db.deviceConnections.put({
      ...conn,
      lastSyncDate: new Date().toISOString(),
      lastSyncStatus: errors.length === 0 ? 'success' : 'error',
      errorMessage: errors.length > 0 ? errors[0] : undefined,
    });
  }

  return {
    success: errors.length === 0,
    syncedDays: rows.length,
    errors,
  };
}

// Test exports
export const _internal = {
  scaleValue,
  aggregateGroups,
  aggregatedToWearable,
};

export { WithingsAuthError };
