// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const settingsHolder = vi.hoisted(() => ({
  current: undefined as any,
  saveCalls: [] as any[],
}));

vi.mock('../lib/db', () => ({
  getSettings: () => Promise.resolve(settingsHolder.current),
  saveSettings: (s: any) => {
    settingsHolder.saveCalls.push(s);
    settingsHolder.current = { ...settingsHolder.current, ...s };
    return Promise.resolve();
  },
}));

import {
  WITHINGS_MEAS_TYPES,
  WithingsAuthError,
  WithingsNotConfiguredError,
  buildAuthorizationUrl,
  consumeOauthState,
  exchangeCodeForToken,
  generateOauthState,
  isWithingsConfigured,
  refreshAccessToken,
  rememberOauthState,
  saveCredentials,
} from '../lib/withings-client';

describe('withings-client', () => {
  beforeEach(() => {
    settingsHolder.current = undefined;
    settingsHolder.saveCalls = [];
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('configuration', () => {
    it('isWithingsConfigured returns false when no credentials', async () => {
      expect(await isWithingsConfigured()).toBe(false);
    });

    it('isWithingsConfigured returns true after saveCredentials', async () => {
      await saveCredentials({
        clientId: 'cid',
        clientSecret: 'secret',
        redirectUri: 'http://localhost/callback',
      });
      expect(await isWithingsConfigured()).toBe(true);
    });

    it('buildAuthorizationUrl throws when not configured', async () => {
      await expect(buildAuthorizationUrl('state')).rejects.toBeInstanceOf(
        WithingsNotConfiguredError
      );
    });

    it('buildAuthorizationUrl emits required params', async () => {
      await saveCredentials({
        clientId: 'cid',
        clientSecret: 's',
        redirectUri: 'http://localhost/cb',
      });
      const url = await buildAuthorizationUrl('xyz123');
      const u = new URL(url);
      expect(u.host).toBe('account.withings.com');
      expect(u.searchParams.get('response_type')).toBe('code');
      expect(u.searchParams.get('client_id')).toBe('cid');
      expect(u.searchParams.get('redirect_uri')).toBe('http://localhost/cb');
      expect(u.searchParams.get('state')).toBe('xyz123');
      expect(u.searchParams.get('scope')).toContain('user.metrics');
    });
  });

  describe('OAuth state CSRF', () => {
    it('generateOauthState returns 32 hex chars', () => {
      const state = generateOauthState();
      expect(state).toMatch(/^[0-9a-f]{32}$/);
    });

    it('rememberOauthState + consumeOauthState round-trip', () => {
      rememberOauthState('abc');
      expect(consumeOauthState()).toBe('abc');
      // Second consume returns null (single-use)
      expect(consumeOauthState()).toBeNull();
    });
  });

  describe('token exchange', () => {
    beforeEach(async () => {
      await saveCredentials({
        clientId: 'cid',
        clientSecret: 'secret',
        redirectUri: 'http://localhost/cb',
      });
    });

    it('exchangeCodeForToken POSTs the right form payload', async () => {
      const fetchMock = vi.fn(async () =>
        new Response(
          JSON.stringify({
            status: 0,
            body: {
              access_token: 'AT',
              refresh_token: 'RT',
              expires_in: 3600,
              scope: 'user.metrics',
              token_type: 'Bearer',
              userid: '12345',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
      vi.stubGlobal('fetch', fetchMock);

      const tokens = await exchangeCodeForToken('CODE-FROM-CALLBACK');

      expect(tokens.accessToken).toBe('AT');
      expect(tokens.refreshToken).toBe('RT');
      expect(tokens.userId).toBe('12345');
      expect(tokens.expiresAt).toBeGreaterThan(Date.now());

      const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
      const [url, init] = calls[0];
      expect(url).toBe('https://wbsapi.withings.net/v2/oauth2');
      expect(init.method).toBe('POST');
      const body = init.body as URLSearchParams;
      expect(body.get('action')).toBe('requesttoken');
      expect(body.get('grant_type')).toBe('authorization_code');
      expect(body.get('client_id')).toBe('cid');
      expect(body.get('client_secret')).toBe('secret');
      expect(body.get('code')).toBe('CODE-FROM-CALLBACK');
    });

    it('refreshAccessToken uses grant_type=refresh_token', async () => {
      const fetchMock = vi.fn(async () =>
        new Response(
          JSON.stringify({
            status: 0,
            body: {
              access_token: 'AT2',
              refresh_token: 'RT2',
              expires_in: 3600,
              scope: 'user.metrics',
              token_type: 'Bearer',
              userid: '12345',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
      vi.stubGlobal('fetch', fetchMock);

      const tokens = await refreshAccessToken('OLD-RT');

      expect(tokens.refreshToken).toBe('RT2'); // rotated
      const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
      const body = calls[0][1].body as URLSearchParams;
      expect(body.get('grant_type')).toBe('refresh_token');
      expect(body.get('refresh_token')).toBe('OLD-RT');
    });

    it('error status surfaces as WithingsAuthError', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          new Response(JSON.stringify({ status: 503, body: {}, error: 'Invalid client' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        )
      );
      await expect(exchangeCodeForToken('bad')).rejects.toBeInstanceOf(WithingsAuthError);
    });
  });

  describe('measure type ids', () => {
    it('exposes critical clinical types', () => {
      expect(WITHINGS_MEAS_TYPES.weight).toBe(1);
      expect(WITHINGS_MEAS_TYPES.systolicBp).toBe(10);
      expect(WITHINGS_MEAS_TYPES.diastolicBp).toBe(9);
      expect(WITHINGS_MEAS_TYPES.heartPulse).toBe(11);
      expect(WITHINGS_MEAS_TYPES.spo2).toBe(54);
    });
  });
});
