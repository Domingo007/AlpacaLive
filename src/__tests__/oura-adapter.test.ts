import { beforeEach, describe, expect, it, vi } from 'vitest';

const stores = vi.hoisted(() => ({
  wearable: new Map<string, any>(),
  configured: true,
  data: {
    sleepDaily: [] as any[],
    sleepSessions: [] as any[],
    readiness: [] as any[],
    activity: [] as any[],
    spo2: [] as any[],
  },
  errors: {
    sleep: null as Error | null,
  },
}));

vi.mock('../lib/db', () => ({
  db: {
    wearable: {
      bulkPut: async (rows: any[]) => {
        for (const r of rows) stores.wearable.set(r.id, r);
      },
    },
  },
}));

vi.mock('../lib/oura-client', () => ({
  ouraClient: {
    isConfigured: async () => stores.configured,
    getDailySleep: async () => stores.data.sleepDaily,
    getSleepSessions: async () => {
      if (stores.errors.sleep) throw stores.errors.sleep;
      return stores.data.sleepSessions;
    },
    getDailyReadiness: async () => stores.data.readiness,
    getDailyActivity: async () => stores.data.activity,
    getDailySpO2: async () => stores.data.spo2,
  },
}));

import { syncOura } from '../lib/oura-adapter';

describe('syncOura', () => {
  beforeEach(() => {
    stores.wearable.clear();
    stores.configured = true;
    stores.data = { sleepDaily: [], sleepSessions: [], readiness: [], activity: [], spo2: [] };
    stores.errors.sleep = null;
  });

  it('returns not_configured when client has no token', async () => {
    stores.configured = false;
    const result = await syncOura(7);
    expect(result.success).toBe(false);
    expect(result.errors).toContain('not_configured');
  });

  it('writes a row per day with provider=oura into the wearable table', async () => {
    stores.data.sleepSessions = [
      {
        id: 's1', day: '2026-05-01',
        total_sleep_duration: 25200, // 7h
        deep_sleep_duration: 5400, // 1.5h
        rem_sleep_duration: 5040, // 1.4h
        light_sleep_duration: 14760, // 4.1h
        average_heart_rate: 60,
        lowest_heart_rate: 52,
        average_hrv: 42,
      },
    ];
    stores.data.activity = [{ id: 'a1', day: '2026-05-01', steps: 8500, high_activity_time: 600, medium_activity_time: 1800 }];
    stores.data.spo2 = [{ id: 'sp1', day: '2026-05-01', spo2_percentage: { average: 97 } }];

    const result = await syncOura(1);

    expect(result.success).toBe(true);
    expect(result.syncedDays).toBe(1);
    const row = stores.wearable.get('ow_2026-05-01_oura');
    expect(row.source).toBe('open_wearables');
    expect(row.provider).toBe('oura');
    expect(row.rhr).toBe(52);
    expect(row.hrv).toBe(42);
    expect(row.spo2).toBe(97);
    expect(row.sleepHours).toBe(7);
    expect(row.deepSleep).toBe(1.5);
    expect(row.steps).toBe(8500);
    expect(row.activeMinutes).toBe(40); // (600+1800)/60
  });

  it('picks the longest session when Oura returns multiple sleep sessions per day (nap + main)', async () => {
    stores.data.sleepSessions = [
      { id: 'nap', day: '2026-05-01', total_sleep_duration: 1800, average_heart_rate: 75 },
      { id: 'main', day: '2026-05-01', total_sleep_duration: 28800, average_heart_rate: 58 },
    ];
    await syncOura(1);
    const row = stores.wearable.get('ow_2026-05-01_oura');
    expect(row.sleepHours).toBe(8); // 28800/3600
    expect(row.rhr).toBe(58); // main session, not nap
  });

  it('partial failure (sleep down) still saves what arrived', async () => {
    stores.data.activity = [{ id: 'a1', day: '2026-05-01', steps: 5000 }];
    stores.errors.sleep = new Error('sleep API down');
    const result = await syncOura(1);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('sleep'))).toBe(true);
    expect(stores.wearable.size).toBe(1);
    expect(stores.wearable.get('ow_2026-05-01_oura').steps).toBe(5000);
  });

  it('idempotent — second sync upserts the same id', async () => {
    stores.data.activity = [{ id: 'a1', day: '2026-05-01', steps: 5000 }];
    await syncOura(1);
    await syncOura(1);
    expect(stores.wearable.size).toBe(1);
  });
});
