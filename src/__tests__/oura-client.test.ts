import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const settingsHolder = vi.hoisted(() => ({ current: undefined as any }));

vi.mock('../lib/db', () => ({
  getSettings: () => Promise.resolve(settingsHolder.current),
}));

import { OuraAuthError, OuraClient, OuraNotConfiguredError } from '../lib/oura-client';

function mockFetch(body: unknown, init: { status?: number } = {}) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  );
}

type FetchMock = ReturnType<typeof mockFetch>;
function lastCall(m: FetchMock) {
  const calls = m.mock.calls as unknown as Array<[string | URL | Request, RequestInit | undefined]>;
  const c = calls[calls.length - 1];
  if (!c) throw new Error('fetch never called');
  return { url: String(c[0]), init: (c[1] ?? {}) as RequestInit };
}

describe('OuraClient', () => {
  let client: OuraClient;
  beforeEach(() => {
    settingsHolder.current = undefined;
    client = new OuraClient();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isConfigured()', () => {
    it('false when no token in settings', async () => {
      expect(await client.isConfigured()).toBe(false);
    });
    it('true when token in settings', async () => {
      settingsHolder.current = { ouraPersonalAccessToken: 'oura-pat-xyz' };
      expect(await client.isConfigured()).toBe(true);
    });
    it('false (not throw) when getSettings rejects', async () => {
      const settingsModule = await import('../lib/db');
      vi.spyOn(settingsModule, 'getSettings').mockRejectedValue(new Error('db gone'));
      expect(await client.isConfigured()).toBe(false);
    });
    it('setToken overrides settings lookup', async () => {
      client.setToken('explicit-token');
      expect(await client.isConfigured()).toBe(true);
    });
  });

  describe('endpoints', () => {
    beforeEach(() => {
      client.setToken('test-pat');
    });

    it('getDailySleep hits /v2/usercollection/daily_sleep with start_date/end_date and Bearer header', async () => {
      const fetchMock = mockFetch({ data: [{ id: '1', day: '2026-05-01', score: 80 }] });
      vi.stubGlobal('fetch', fetchMock);

      const result = await client.getDailySleep('2026-05-01', '2026-05-07');

      expect(result).toHaveLength(1);
      const { url, init } = lastCall(fetchMock);
      expect(url).toBe('https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=2026-05-01&end_date=2026-05-07');
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer test-pat');
    });

    it('getSleepSessions parses session data', async () => {
      vi.stubGlobal('fetch', mockFetch({
        data: [{ id: 's1', day: '2026-05-01', total_sleep_duration: 25200, average_heart_rate: 58 }],
      }));
      const result = await client.getSleepSessions('2026-05-01', '2026-05-07');
      expect(result[0].total_sleep_duration).toBe(25200);
      expect(result[0].average_heart_rate).toBe(58);
    });

    it('routes readiness / activity / spo2 endpoints correctly', async () => {
      const fetchMock = mockFetch({ data: [] });
      vi.stubGlobal('fetch', fetchMock);
      await client.getDailyReadiness('2026-05-01', '2026-05-07');
      await client.getDailyActivity('2026-05-01', '2026-05-07');
      await client.getDailySpO2('2026-05-01', '2026-05-07');
      const calls = fetchMock.mock.calls as unknown as Array<[string]>;
      const urls = calls.map(c => String(c[0]));
      expect(urls[0]).toContain('/usercollection/daily_readiness');
      expect(urls[1]).toContain('/usercollection/daily_activity');
      expect(urls[2]).toContain('/usercollection/daily_spo2');
    });
  });

  describe('errors', () => {
    it('NotConfigured when token missing and request attempted', async () => {
      await expect(client.getDailySleep('2026-05-01', '2026-05-07')).rejects.toBeInstanceOf(OuraNotConfiguredError);
    });
    it('401 → OuraAuthError', async () => {
      client.setToken('bad');
      vi.stubGlobal('fetch', mockFetch({}, { status: 401 }));
      await expect(client.getDailySleep('2026-05-01', '2026-05-07')).rejects.toBeInstanceOf(OuraAuthError);
    });
    it('ping returns false on auth failure (does not throw)', async () => {
      client.setToken('bad');
      vi.stubGlobal('fetch', mockFetch({}, { status: 401 }));
      expect(await client.ping()).toBe(false);
    });
    it('ping returns true on success', async () => {
      client.setToken('good');
      vi.stubGlobal('fetch', mockFetch({ id: 'me' }));
      expect(await client.ping()).toBe(true);
    });
  });
});
