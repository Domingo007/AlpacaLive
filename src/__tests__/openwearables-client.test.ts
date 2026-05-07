import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSettings = vi.fn();

vi.mock('../lib/db', () => ({
  getSettings: () => mockGetSettings(),
}));

import { OpenWearablesClient } from '../lib/openwearables-client';
import {
  OpenWearablesAuthError,
  OpenWearablesNotConfiguredError,
  OpenWearablesServerError,
} from '../types/openwearables';

const TEST_CONFIG = {
  baseUrl: 'http://localhost:8000',
  apiKey: 'test-key-abc',
  userId: 'patient-123',
};

function mockFetch(body: unknown, init: { status?: number; statusText?: string } = {}) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      statusText: init.statusText ?? 'OK',
      headers: { 'content-type': 'application/json' },
    })
  );
}

type FetchMock = ReturnType<typeof mockFetch>;

function lastCall(fetchMock: FetchMock): { url: string; init: RequestInit } {
  const calls = fetchMock.mock.calls as unknown as Array<[string | URL | Request, RequestInit | undefined]>;
  const call = calls[calls.length - 1];
  if (!call) throw new Error('fetch was never called');
  return { url: String(call[0]), init: (call[1] ?? {}) as RequestInit };
}

describe('OpenWearablesClient', () => {
  let client: OpenWearablesClient;

  beforeEach(() => {
    client = new OpenWearablesClient();
    mockGetSettings.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isConfigured()', () => {
    it('returns false when settings table is empty', async () => {
      mockGetSettings.mockResolvedValueOnce(undefined);
      expect(await client.isConfigured()).toBe(false);
    });

    it('returns false when OW fields are missing', async () => {
      mockGetSettings.mockResolvedValueOnce({ apiKey: '', openWearablesBaseUrl: '' });
      expect(await client.isConfigured()).toBe(false);
    });

    it('returns false (not throw) when getSettings rejects', async () => {
      mockGetSettings.mockRejectedValueOnce(new Error('db closed'));
      expect(await client.isConfigured()).toBe(false);
    });

    it('returns true when injected config is valid', async () => {
      client.setConfig(TEST_CONFIG);
      expect(await client.isConfigured()).toBe(true);
    });

    it('reads valid OW fields from getSettings()', async () => {
      mockGetSettings.mockResolvedValueOnce({
        openWearablesBaseUrl: 'http://localhost:8000///',
        openWearablesApiKey: 'k',
        openWearablesUserId: 'u',
      });
      const config = await client.getConfig();
      expect(config?.baseUrl).toBe('http://localhost:8000');
      expect(config?.apiKey).toBe('k');
      expect(config?.userId).toBe('u');
    });
  });

  describe('startConnect()', () => {
    it('throws NotConfigured when no config available', async () => {
      mockGetSettings.mockResolvedValue(undefined);
      await expect(client.startConnect('whoop')).rejects.toBeInstanceOf(
        OpenWearablesNotConfiguredError
      );
    });

    it('hits /api/v1/oauth/{provider}/authorize with X-Open-Wearables-API-Key header', async () => {
      client.setConfig(TEST_CONFIG);
      const fetchMock = mockFetch({ authorization_url: 'https://provider.example/oauth' });
      vi.stubGlobal('fetch', fetchMock);

      const result = await client.startConnect('whoop');

      expect(result.authorizationUrl).toBe('https://provider.example/oauth');
      const { url, init } = lastCall(fetchMock);
      expect(url).toBe('http://localhost:8000/api/v1/oauth/whoop/authorize?user_id=patient-123');
      expect(init.method).toBe('GET');
      const headers = init.headers as Record<string, string>;
      expect(headers['X-Open-Wearables-API-Key']).toBe('test-key-abc');
    });

    it('throws ServerError when response lacks an authorization URL', async () => {
      client.setConfig(TEST_CONFIG);
      vi.stubGlobal('fetch', mockFetch({}));
      await expect(client.startConnect('oura')).rejects.toBeInstanceOf(OpenWearablesServerError);
    });
  });

  describe('listConnections()', () => {
    it('reads connections array from response', async () => {
      client.setConfig(TEST_CONFIG);
      vi.stubGlobal(
        'fetch',
        mockFetch({
          connections: [
            { provider: 'oura', connectedAt: '2026-05-01', status: 'active' },
            { provider: 'whoop', connectedAt: '2026-05-02', status: 'active' },
          ],
        })
      );

      const connections = await client.listConnections();
      expect(connections).toHaveLength(2);
      expect(connections[0].provider).toBe('oura');
    });

    it('falls back to data field when connections is missing', async () => {
      client.setConfig(TEST_CONFIG);
      vi.stubGlobal('fetch', mockFetch({ data: [] }));
      expect(await client.listConnections()).toEqual([]);
    });
  });

  describe('summary endpoints', () => {
    it('builds the correct query string and endpoint for activity', async () => {
      client.setConfig(TEST_CONFIG);
      const fetchMock = mockFetch({ data: [] });
      vi.stubGlobal('fetch', fetchMock);

      await client.getActivity('2026-05-01', '2026-05-07');

      const { url } = lastCall(fetchMock);
      expect(url).toContain('/api/v1/users/patient-123/summaries/activity');
      expect(url).toContain('start_date=2026-05-01');
      expect(url).toContain('end_date=2026-05-07');
    });

    it('routes sleep / body / recovery to the matching endpoint', async () => {
      client.setConfig(TEST_CONFIG);
      const fetchMock = mockFetch({ data: [] });
      vi.stubGlobal('fetch', fetchMock);

      await client.getSleep('2026-05-01', '2026-05-07');
      await client.getBody('2026-05-01', '2026-05-07');
      await client.getRecovery('2026-05-01', '2026-05-07');

      const calls = fetchMock.mock.calls as unknown as Array<[string | URL | Request, RequestInit | undefined]>;
      const urls = calls.map((c) => String(c[0]));
      expect(urls[0]).toContain('/summaries/sleep');
      expect(urls[1]).toContain('/summaries/body');
      expect(urls[2]).toContain('/summaries/recovery');
    });
  });

  describe('error handling', () => {
    it('maps 401 to OpenWearablesAuthError', async () => {
      client.setConfig(TEST_CONFIG);
      vi.stubGlobal('fetch', mockFetch({}, { status: 401, statusText: 'Unauthorized' }));
      await expect(client.listConnections()).rejects.toBeInstanceOf(OpenWearablesAuthError);
    });

    it('maps 5xx to OpenWearablesServerError with status', async () => {
      client.setConfig(TEST_CONFIG);
      vi.stubGlobal('fetch', mockFetch({}, { status: 503, statusText: 'Unavailable' }));
      try {
        await client.listConnections();
        throw new Error('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(OpenWearablesServerError);
        expect((err as OpenWearablesServerError).status).toBe(503);
      }
    });
  });
});
