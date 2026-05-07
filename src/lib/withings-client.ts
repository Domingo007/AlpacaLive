/*
 * Withings OAuth2 + Public Health Data API client.
 *
 * Spec: https://developer.withings.com/api-reference/
 *
 * KEY FACTS (verified via curl spike 2026-05-07):
 * - Token endpoint https://wbsapi.withings.net/v2/oauth2 supports CORS
 *   for browser origins (Access-Control-Allow-Origin: *), so the PWA
 *   can do token exchange + refresh directly without a backend proxy.
 * - Token exchange requires client_secret in the body — there is no
 *   PKCE in the public flow. We accept that each AlpacaLive install
 *   uses ITS OWN Withings developer credentials (Client ID + Secret)
 *   stored in AppSettings (Dexie), per the project convention for
 *   third-party API keys.
 * - Refresh token rotates on each refresh — caller must persist the
 *   new refresh_token returned alongside the new access_token.
 * - 30-second window from authorization callback to code exchange.
 */

import { getSettings, saveSettings } from './db';

const AUTH_BASE = 'https://account.withings.com/oauth2_user/authorize2';
const API_BASE = 'https://wbsapi.withings.net';

const DEFAULT_SCOPES = ['user.info', 'user.metrics', 'user.activity'];

/** Withings measure type IDs we know about. EDA/ESC type id is heuristic — Withings
 *  hasn't officially documented it; we map any type with EDA-like values when present. */
export const WITHINGS_MEAS_TYPES = {
  weight: 1,
  height: 4,
  fatFreeMass: 5,
  fatRatio: 6,
  fatMass: 8,
  diastolicBp: 9,
  systolicBp: 10,
  heartPulse: 11,
  bodyTemperature: 12,
  spo2: 54,
  muscleMass: 76,
  hydration: 77,
  boneMass: 88,
  pulseWaveVelocity: 91,
  vo2max: 123,
} as const;

export type WithingsMeasType = (typeof WITHINGS_MEAS_TYPES)[keyof typeof WITHINGS_MEAS_TYPES];

export interface WithingsTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  userid: string;
}

export interface WithingsTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
  scope: string;
}

export interface WithingsMeasureGroup {
  grpid: number;
  attrib: number;
  date: number;
  category: number;
  measures: Array<{
    value: number;
    type: number;
    unit: number;
  }>;
}

export class WithingsNotConfiguredError extends Error {
  constructor() {
    super('Withings is not configured');
    this.name = 'WithingsNotConfiguredError';
  }
}

export class WithingsAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WithingsAuthError';
  }
}

interface WithingsConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

async function loadConfig(): Promise<WithingsConfig | null> {
  let settings;
  try {
    settings = await getSettings();
  } catch {
    return null;
  }
  if (!settings) return null;
  const clientId = settings.withingsClientId?.trim();
  const clientSecret = settings.withingsClientSecret?.trim();
  const redirectUri = settings.withingsRedirectUri?.trim();
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

export async function isWithingsConfigured(): Promise<boolean> {
  return (await loadConfig()) !== null;
}

const STATE_KEY = 'alpacalive-withings-oauth-state';

export function generateOauthState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Persist + return CSRF state for the in-flight OAuth attempt. */
export function rememberOauthState(state: string): void {
  sessionStorage.setItem(STATE_KEY, state);
}

export function consumeOauthState(): string | null {
  const stored = sessionStorage.getItem(STATE_KEY);
  if (stored) sessionStorage.removeItem(STATE_KEY);
  return stored;
}

/** Build the authorization URL the user must visit (via window.location). */
export async function buildAuthorizationUrl(
  state: string,
  scopes: string[] = DEFAULT_SCOPES
): Promise<string> {
  const config = await loadConfig();
  if (!config) throw new WithingsNotConfiguredError();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    scope: scopes.join(','),
    redirect_uri: config.redirectUri,
    state,
  });
  return `${AUTH_BASE}?${params.toString()}`;
}

async function postToken(body: URLSearchParams): Promise<WithingsTokenResponse> {
  const response = await fetch(`${API_BASE}/v2/oauth2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    throw new WithingsAuthError(`Withings token endpoint HTTP ${response.status}`);
  }
  const data = (await response.json()) as { status: number; body: WithingsTokenResponse; error?: string };
  if (data.status !== 0) {
    throw new WithingsAuthError(`Withings: ${data.error ?? 'status ' + data.status}`);
  }
  return data.body;
}

/** Exchange the OAuth authorization code for an access + refresh token. */
export async function exchangeCodeForToken(code: string): Promise<WithingsTokens> {
  const config = await loadConfig();
  if (!config) throw new WithingsNotConfiguredError();
  const body = new URLSearchParams({
    action: 'requesttoken',
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
  });
  const tokens = await postToken(body);
  return tokensFromResponse(tokens);
}

/** Refresh an expired access token. Withings rotates the refresh_token. */
export async function refreshAccessToken(refreshToken: string): Promise<WithingsTokens> {
  const config = await loadConfig();
  if (!config) throw new WithingsNotConfiguredError();
  const body = new URLSearchParams({
    action: 'requesttoken',
    grant_type: 'refresh_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  });
  const tokens = await postToken(body);
  return tokensFromResponse(tokens);
}

function tokensFromResponse(response: WithingsTokenResponse): WithingsTokens {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresAt: Date.now() + response.expires_in * 1000,
    userId: String(response.userid),
    scope: response.scope,
  };
}

/** Persist Withings tokens onto the deviceConnections row. */
export async function saveTokens(tokens: WithingsTokens): Promise<void> {
  const { db } = await import('./db');
  await db.deviceConnections.put({
    id: 'withings',
    connected: true,
    lastSyncDate: new Date().toISOString(),
    lastSyncStatus: 'success',
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenExpiresAt: tokens.expiresAt,
    externalUserId: tokens.userId,
  });
}

export async function loadTokens(): Promise<WithingsTokens | null> {
  const { db } = await import('./db');
  const conn = await db.deviceConnections.get('withings');
  if (!conn || !conn.accessToken || !conn.refreshToken || !conn.tokenExpiresAt) return null;
  return {
    accessToken: conn.accessToken,
    refreshToken: conn.refreshToken,
    expiresAt: conn.tokenExpiresAt,
    userId: conn.externalUserId ?? '',
    scope: '',
  };
}

/** Disconnect Withings — wipes tokens but leaves history rows. */
export async function disconnectWithings(): Promise<void> {
  const { db } = await import('./db');
  await db.deviceConnections.put({
    id: 'withings',
    connected: false,
    lastSyncDate: undefined,
    lastSyncStatus: undefined,
    accessToken: undefined,
    refreshToken: undefined,
    tokenExpiresAt: undefined,
    externalUserId: undefined,
  });
}

/** Fetch a fresh access token, refreshing if expired. Persists rotated tokens. */
export async function withFreshToken(): Promise<WithingsTokens> {
  const tokens = await loadTokens();
  if (!tokens) throw new WithingsAuthError('No Withings tokens — connect first');
  // refresh 60s before expiry
  if (tokens.expiresAt < Date.now() + 60_000) {
    const fresh = await refreshAccessToken(tokens.refreshToken);
    await saveTokens(fresh);
    return fresh;
  }
  return tokens;
}

/** Convenience helper: persist initial Withings developer credentials. */
export async function saveCredentials(creds: WithingsConfig): Promise<void> {
  await saveSettings({
    withingsClientId: creds.clientId,
    withingsClientSecret: creds.clientSecret,
    withingsRedirectUri: creds.redirectUri,
  });
}

/** GET measures via Withings API (POST body, despite docs saying GET). */
export async function getMeasures(
  meastypes: WithingsMeasType[],
  startUnix: number,
  endUnix: number
): Promise<WithingsMeasureGroup[]> {
  const tokens = await withFreshToken();
  const body = new URLSearchParams({
    action: 'getmeas',
    meastypes: meastypes.join(','),
    startdate: String(startUnix),
    enddate: String(endUnix),
  });
  const response = await fetch(`${API_BASE}/measure?access_token=${tokens.accessToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) throw new WithingsAuthError(`measure endpoint HTTP ${response.status}`);
  const data = (await response.json()) as { status: number; body: { measuregrps?: WithingsMeasureGroup[] }; error?: string };
  if (data.status !== 0) throw new WithingsAuthError(data.error ?? `status ${data.status}`);
  return data.body.measuregrps ?? [];
}

export interface WithingsSleepSummary {
  date: string;
  durationMinutes?: number;
  deepMinutes?: number;
  lightMinutes?: number;
  remMinutes?: number;
  awakeMinutes?: number;
  hr_average?: number;
  hr_min?: number;
  hr_max?: number;
  hrv?: number;
}

export async function getSleep(startUnix: number, endUnix: number): Promise<WithingsSleepSummary[]> {
  const tokens = await withFreshToken();
  const body = new URLSearchParams({
    action: 'getsummary',
    startdateymd: unixToYmd(startUnix),
    enddateymd: unixToYmd(endUnix),
  });
  const response = await fetch(`${API_BASE}/v2/sleep?access_token=${tokens.accessToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) throw new WithingsAuthError(`sleep endpoint HTTP ${response.status}`);
  const data = (await response.json()) as { status: number; body?: { series?: any[] }; error?: string };
  if (data.status !== 0) throw new WithingsAuthError(data.error ?? `status ${data.status}`);
  const series = data.body?.series ?? [];
  return series.map((s: any) => ({
    date: s.date,
    durationMinutes: typeof s.data?.total_sleep_time === 'number' ? s.data.total_sleep_time / 60 : undefined,
    deepMinutes: typeof s.data?.deepsleepduration === 'number' ? s.data.deepsleepduration / 60 : undefined,
    lightMinutes: typeof s.data?.lightsleepduration === 'number' ? s.data.lightsleepduration / 60 : undefined,
    remMinutes: typeof s.data?.remsleepduration === 'number' ? s.data.remsleepduration / 60 : undefined,
    awakeMinutes: typeof s.data?.wakeupduration === 'number' ? s.data.wakeupduration / 60 : undefined,
    hr_average: s.data?.hr_average,
    hr_min: s.data?.hr_min,
    hr_max: s.data?.hr_max,
    hrv: s.data?.hrv,
  }));
}

function unixToYmd(unix: number): string {
  return new Date(unix * 1000).toISOString().split('T')[0];
}

/** Test-only helpers. */
export const _internal = {
  loadConfig,
  tokensFromResponse,
  postToken,
};
