import { describe, expect, it, vi } from 'vitest';

const stores = vi.hoisted(() => ({
  wearable: new Map<string, any>(),
  deviceConnections: new Map<string, any>(),
  configured: true,
  tokens: { ok: true },
  measuresThrows: null as Error | null,
  sleepThrows: null as Error | null,
  measureGroups: [] as any[],
  sleepSeries: [] as any[],
}));

vi.mock('../lib/db', () => ({
  db: {
    wearable: {
      bulkPut: async (rows: any[]) => {
        for (const r of rows) stores.wearable.set(r.id, r);
      },
    },
    deviceConnections: {
      get: async (id: string) => stores.deviceConnections.get(id),
      put: async (row: any) => {
        stores.deviceConnections.set(row.id, row);
      },
    },
  },
}));

vi.mock('../lib/withings-client', async () => {
  const actual = await vi.importActual<typeof import('../lib/withings-client')>(
    '../lib/withings-client'
  );
  return {
    ...actual,
    isWithingsConfigured: async () => stores.configured,
    loadTokens: async () => (stores.tokens.ok ? { accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 1e6, userId: '1', scope: '' } : null),
    getMeasures: async () => {
      if (stores.measuresThrows) throw stores.measuresThrows;
      return stores.measureGroups;
    },
    getSleep: async () => {
      if (stores.sleepThrows) throw stores.sleepThrows;
      return stores.sleepSeries;
    },
  };
});

import { _internal, syncWithings } from '../lib/withings-adapter';

describe('withings-adapter', () => {
  beforeEach(() => {
    stores.wearable.clear();
    stores.deviceConnections.clear();
    stores.configured = true;
    stores.tokens.ok = true;
    stores.measuresThrows = null;
    stores.sleepThrows = null;
    stores.measureGroups = [];
    stores.sleepSeries = [];
  });

  describe('scaleValue', () => {
    it('applies the unit exponent (Withings sends value*10^unit)', () => {
      expect(_internal.scaleValue(7820, -2)).toBeCloseTo(78.2);
      expect(_internal.scaleValue(1200, -1)).toBeCloseTo(120);
    });
  });

  describe('aggregateGroups', () => {
    it('maps known measure types to aggregated fields', () => {
      const groups = [
        {
          grpid: 1,
          attrib: 0,
          date: 1746115200, // 2026-05-01
          category: 1,
          measures: [
            { value: 7820, type: 1, unit: -2 }, // weight 78.2
            { value: 1200, type: 10, unit: -1 }, // systolic 120
            { value: 800, type: 9, unit: -1 }, // diastolic 80
            { value: 65, type: 11, unit: 0 }, // heart pulse
          ],
        },
      ];
      const days = _internal.aggregateGroups(groups);
      const day = Array.from(days.values())[0];
      expect(day.weight).toBeCloseTo(78.2);
      expect(day.systolicBp).toBe(120);
      expect(day.diastolicBp).toBe(80);
      expect(day.heartPulse).toBe(65);
    });

    it('captures heuristic ESC measures (type 130-199 range)', () => {
      const groups = [
        {
          grpid: 1,
          attrib: 0,
          date: 1746115200,
          category: 1,
          measures: [
            { value: 60, type: 132, unit: 0 }, // even → foot
            { value: 70, type: 133, unit: 0 }, // odd → hand
          ],
        },
      ];
      const days = _internal.aggregateGroups(groups);
      const day = Array.from(days.values())[0];
      expect(day.esc?.foot).toBe(60);
      expect(day.esc?.hand).toBe(70);
    });
  });

  describe('syncWithings', () => {
    it('returns not_configured when credentials are missing', async () => {
      stores.configured = false;
      const result = await syncWithings(7);
      expect(result.success).toBe(false);
      expect(result.errors).toContain('not_configured');
    });

    it('returns not_authorized when no tokens stored', async () => {
      stores.tokens.ok = false;
      const result = await syncWithings(7);
      expect(result.success).toBe(false);
      expect(result.errors).toContain('not_authorized');
    });

    it('persists wearable rows with source=withings and ESC when present', async () => {
      stores.measureGroups = [
        {
          grpid: 1,
          attrib: 0,
          date: 1746115200,
          category: 1,
          measures: [
            { value: 7820, type: 1, unit: -2 },
            { value: 60, type: 132, unit: 0 }, // ESC foot
          ],
        },
      ];
      stores.sleepSeries = [];
      const result = await syncWithings(7);
      expect(result.success).toBe(true);
      const rows = Array.from(stores.wearable.values());
      expect(rows).toHaveLength(1);
      expect(rows[0].source).toBe('withings');
      expect(rows[0].electrochemicalSkinConductance?.foot).toBe(60);
    });

    it('partial failure (sleep down) still saves measures and returns errors', async () => {
      stores.measureGroups = [
        {
          grpid: 1,
          attrib: 0,
          date: 1746115200,
          category: 1,
          measures: [{ value: 7820, type: 1, unit: -2 }],
        },
      ];
      stores.sleepThrows = new Error('sleep API down');
      const result = await syncWithings(7);
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes('sleep'))).toBe(true);
      expect(stores.wearable.size).toBe(1);
    });

    it('updates deviceConnections.lastSync after successful sync', async () => {
      stores.deviceConnections.set('withings', {
        id: 'withings',
        connected: true,
        accessToken: 'a',
      });
      stores.measureGroups = [
        {
          grpid: 1,
          attrib: 0,
          date: 1746115200,
          category: 1,
          measures: [{ value: 7820, type: 1, unit: -2 }],
        },
      ];
      await syncWithings(7);
      const conn = stores.deviceConnections.get('withings');
      expect(conn.lastSyncStatus).toBe('success');
      expect(conn.lastSyncDate).toBeDefined();
    });
  });
});

import { beforeEach } from 'vitest';
