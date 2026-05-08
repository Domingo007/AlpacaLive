import { beforeEach, describe, expect, it, vi } from 'vitest';

const stores = vi.hoisted(() => ({
  wearable: new Map<string, any>(),
  configured: true,
  tokensOk: true,
  activities: [] as any[],
  activitiesError: null as Error | null,
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

vi.mock('../lib/strava-client', async () => {
  const actual = await vi.importActual<typeof import('../lib/strava-client')>('../lib/strava-client');
  return {
    ...actual,
    isStravaConfigured: async () => stores.configured,
    loadTokens: async () => (stores.tokensOk ? { accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 1e6 } : null),
    getActivities: async () => {
      if (stores.activitiesError) throw stores.activitiesError;
      return stores.activities;
    },
  };
});

import { _internal, syncStrava } from '../lib/strava-adapter';

describe('strava-adapter', () => {
  beforeEach(() => {
    stores.wearable.clear();
    stores.configured = true;
    stores.tokensOk = true;
    stores.activities = [];
    stores.activitiesError = null;
  });

  describe('bucketize', () => {
    it('aggregates two activities on the same day into one bucket', () => {
      const buckets = _internal.bucketize([
        { id: 1, type: 'Run', start_date: '2026-05-01T08:00Z', start_date_local: '2026-05-01T08:00', moving_time: 1800, average_heartrate: 150 },
        { id: 2, type: 'Ride', start_date: '2026-05-01T18:00Z', start_date_local: '2026-05-01T18:00', moving_time: 3600, average_heartrate: 130 },
      ] as any);
      const day = buckets.get('2026-05-01')!;
      expect(day.totalMovingSec).toBe(5400);
      // Weighted average: (150*1800 + 130*3600) / 5400 = 136.66...
      expect(day.weightedHrSum / day.weightedHrWeight).toBeCloseTo(136.67, 1);
    });

    it('handles activities without HR data', () => {
      const buckets = _internal.bucketize([
        { id: 1, type: 'Walk', start_date_local: '2026-05-01T08:00', moving_time: 1200 },
      ] as any);
      const day = buckets.get('2026-05-01')!;
      expect(day.weightedHrWeight).toBe(0);
    });
  });

  describe('syncStrava', () => {
    it('returns not_configured when client lacks credentials', async () => {
      stores.configured = false;
      const result = await syncStrava(7);
      expect(result.success).toBe(false);
      expect(result.errors).toContain('not_configured');
    });

    it('returns not_authorized when no tokens stored', async () => {
      stores.tokensOk = false;
      const result = await syncStrava(7);
      expect(result.errors).toContain('not_authorized');
    });

    it('persists per-day rows with provider=strava', async () => {
      stores.activities = [
        { id: 1, type: 'Run', start_date_local: '2026-05-01T08:00', moving_time: 1800, average_heartrate: 150 },
        { id: 2, type: 'Ride', start_date_local: '2026-05-02T08:00', moving_time: 3600, average_heartrate: 130 },
      ];
      const result = await syncStrava(7);
      expect(result.success).toBe(true);
      expect(result.syncedDays).toBe(2);
      const row1 = stores.wearable.get('ow_2026-05-01_strava');
      expect(row1.source).toBe('open_wearables');
      expect(row1.provider).toBe('strava');
      expect(row1.activeMinutes).toBe(30); // 1800/60
      expect(row1.respiratoryRate).toBe(150); // weighted avg HR
    });

    it('idempotent', async () => {
      stores.activities = [
        { id: 1, type: 'Run', start_date_local: '2026-05-01T08:00', moving_time: 1800 },
      ];
      await syncStrava(7);
      await syncStrava(7);
      expect(stores.wearable.size).toBe(1);
    });

    it('partial failure reports auth error', async () => {
      const { StravaAuthError } = await import('../lib/strava-client');
      stores.activitiesError = new StravaAuthError('token rejected');
      const result = await syncStrava(7);
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('auth');
    });
  });
});
