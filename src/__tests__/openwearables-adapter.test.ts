import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted runs before the hoisted vi.mock() factories.
// Plain data containers + plain async fns — no vi.fn dependencies inside hoisted.
const stores = vi.hoisted(() => ({
  wearableStore: new Map<string, any>(),
  dailyStore: new Map<string, any>(),
  client: {
    isConfigured: false,
    activity: [] as any[],
    sleep: [] as any[],
    body: [] as any[],
    recovery: [] as any[],
    activityError: null as Error | null,
    sleepError: null as Error | null,
    bodyError: null as Error | null,
    recoveryError: null as Error | null,
  },
}));

const { wearableStore, dailyStore, client } = stores;

vi.mock('../lib/db', () => ({
  db: {
    wearable: {
      bulkPut: async (rows: any[]) => {
        for (const row of rows) wearableStore.set(row.id, row);
      },
      where: (field: string) => ({
        equals: (value: string) => ({
          toArray: async () =>
            Array.from(wearableStore.values()).filter((r) => r[field] === value),
        }),
      }),
    },
    daily: {
      where: (field: string) => ({
        equals: (value: string) => ({
          first: async () =>
            Array.from(dailyStore.values()).find((r) => r[field] === value),
        }),
      }),
    },
  },
  getSettings: () => Promise.resolve(undefined),
}));

vi.mock('../lib/openwearables-client', () => ({
  openWearablesClient: {
    isConfigured: async () => client.isConfigured,
    getActivity: async () => {
      if (client.activityError) throw client.activityError;
      return client.activity;
    },
    getSleep: async () => {
      if (client.sleepError) throw client.sleepError;
      return client.sleep;
    },
    getBody: async () => {
      if (client.bodyError) throw client.bodyError;
      return client.body;
    },
    getRecovery: async () => {
      if (client.recoveryError) throw client.recoveryError;
      return client.recovery;
    },
  },
}));

function resetClient() {
  client.isConfigured = false;
  client.activity = [];
  client.sleep = [];
  client.body = [];
  client.recovery = [];
  client.activityError = null;
  client.sleepError = null;
  client.bodyError = null;
  client.recoveryError = null;
}

import {
  _internal,
  getMergedDailyData,
  syncOpenWearables,
} from '../lib/openwearables-adapter';

describe('openwearables-adapter', () => {
  beforeEach(() => {
    wearableStore.clear();
    dailyStore.clear();
    resetClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('syncOpenWearables', () => {
    it('returns not_configured when client is not configured', async () => {
      client.isConfigured = false;
      const result = await syncOpenWearables(7);
      expect(result.success).toBe(false);
      expect(result.errors).toContain('not_configured');
      expect(result.syncedDays).toBe(0);
    });

    it('persists rows from all 4 summary streams keyed by (date, provider)', async () => {
      client.isConfigured = true;
      client.activity = [
        { date: '2026-05-01', source: 'oura', steps: 8000 },
        { date: '2026-05-02', source: 'oura', steps: 9000 },
      ];
      client.sleep = [
        { date: '2026-05-01', source: 'oura', durationMinutes: 420, deepMinutes: 90 },
      ];
      client.recovery = [
        { date: '2026-05-01', source: 'oura', restingHeartRate: 58, hrvMs: 45 },
      ];

      const result = await syncOpenWearables(2);

      expect(result.success).toBe(true);
      expect(result.providers).toEqual(['oura']);
      expect(result.syncedDays).toBe(2);
      expect(wearableStore.size).toBe(2);
      const may1 = wearableStore.get('ow_2026-05-01_oura');
      expect(may1.rhr).toBe(58);
      expect(may1.steps).toBe(8000);
      expect(may1.sleepHours).toBe(7);
      expect(may1.deepSleep).toBe(1.5);
    });

    it('is idempotent — second sync upserts the same id', async () => {
      client.isConfigured = true;
      client.activity = [{ date: '2026-05-01', source: 'whoop', steps: 5000 }];

      await syncOpenWearables(1);
      await syncOpenWearables(1);

      expect(wearableStore.size).toBe(1);
    });

    it('partial failure — captures per-stream errors but still persists what arrived', async () => {
      client.isConfigured = true;
      client.activity = [{ date: '2026-05-01', source: 'oura', steps: 7000 }];
      client.sleepError = new Error('sleep API down');

      const result = await syncOpenWearables(1);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes('sleep'))).toBe(true);
      expect(wearableStore.size).toBe(1); // activity row still saved
    });

    it('separate buckets for different providers on the same day', async () => {
      client.isConfigured = true;
      client.activity = [
        { date: '2026-05-01', source: 'oura', steps: 7000 },
        { date: '2026-05-01', source: 'garmin', steps: 8500 },
      ];

      await syncOpenWearables(1);

      expect(wearableStore.size).toBe(2);
      expect(wearableStore.has('ow_2026-05-01_oura')).toBe(true);
      expect(wearableStore.has('ow_2026-05-01_garmin')).toBe(true);
    });
  });

  describe('getMergedDailyData', () => {
    it('returns source=none when no data exists for the date', async () => {
      const result = await getMergedDailyData('2026-05-01');
      expect(result.source).toBe('none');
    });

    it('source=manual when only DailyLog exists', async () => {
      dailyStore.set('1', { date: '2026-05-01', heartRate: 72 });
      const result = await getMergedDailyData('2026-05-01');
      expect(result.source).toBe('manual');
      expect(result.rhr).toBe(72);
    });

    it('source=open_wearables takes priority over manual DailyLog', async () => {
      wearableStore.set('ow_2026-05-01_oura', {
        id: 'ow_2026-05-01_oura',
        date: '2026-05-01',
        source: 'open_wearables',
        provider: 'oura',
        rhr: 58,
        hrv: 45,
        spo2: 98,
        sleepHours: 7,
        deepSleep: 1.5,
        remSleep: 1.4,
        lightSleep: 4.1,
        steps: 8000,
        activeMinutes: 30,
        biocharge: 0,
      });
      dailyStore.set('1', { date: '2026-05-01', heartRate: 72 });

      const result = await getMergedDailyData('2026-05-01');

      expect(result.source).toBe('open_wearables');
      expect(result.attribution).toBe('oura');
      expect(result.rhr).toBe(58); // wearable wins over manual
    });

    it('priority oura > garmin when both report the same day', async () => {
      const baseRow = {
        date: '2026-05-01',
        source: 'open_wearables' as const,
        spo2: 0,
        sleepHours: 0,
        deepSleep: 0,
        remSleep: 0,
        lightSleep: 0,
        steps: 0,
        activeMinutes: 0,
        biocharge: 0,
      };
      wearableStore.set('ow_2026-05-01_garmin', {
        ...baseRow,
        id: 'ow_2026-05-01_garmin',
        provider: 'garmin',
        rhr: 65,
        hrv: 35,
      });
      wearableStore.set('ow_2026-05-01_oura', {
        ...baseRow,
        id: 'ow_2026-05-01_oura',
        provider: 'oura',
        rhr: 58,
        hrv: 45,
      });

      const result = await getMergedDailyData('2026-05-01');

      expect(result.attribution).toBe('oura');
      expect(result.rhr).toBe(58);
    });

    it('source=withings_direct trumps open_wearables when both exist', async () => {
      wearableStore.set('w_1', {
        id: 'w_1',
        date: '2026-05-01',
        source: 'withings',
        rhr: 60,
        hrv: 40,
        spo2: 0,
        sleepHours: 0,
        deepSleep: 0,
        remSleep: 0,
        lightSleep: 0,
        steps: 0,
        activeMinutes: 0,
        biocharge: 0,
        electrochemicalSkinConductance: { foot: 65, date: '2026-05-01' },
      });
      wearableStore.set('ow_2026-05-01_oura', {
        id: 'ow_2026-05-01_oura',
        date: '2026-05-01',
        source: 'open_wearables',
        provider: 'oura',
        rhr: 58,
        hrv: 45,
        spo2: 98,
        sleepHours: 7,
        deepSleep: 1.5,
        remSleep: 1.4,
        lightSleep: 4.1,
        steps: 8000,
        activeMinutes: 30,
        biocharge: 0,
      });

      const result = await getMergedDailyData('2026-05-01');

      expect(result.source).toBe('withings_direct');
      expect(result.rhr).toBe(60); // withings wins
      // ESC only available from withings — exposed regardless of HR source
      expect(result.electrochemicalSkinConductance?.foot).toBe(65);
      // OW provides sleep where Withings doesn't — fills via priority chain
      expect(result.sleepHours).toBe(7);
    });
  });

  describe('PROVIDER_PRIORITY', () => {
    it('oura outranks all consumer ecosystems', () => {
      const { PROVIDER_PRIORITY } = _internal;
      expect(PROVIDER_PRIORITY.oura).toBeGreaterThan(PROVIDER_PRIORITY.garmin);
      expect(PROVIDER_PRIORITY.oura).toBeGreaterThan(PROVIDER_PRIORITY.strava);
      expect(PROVIDER_PRIORITY.whoop).toBeGreaterThan(PROVIDER_PRIORITY.strava);
    });
  });
});
