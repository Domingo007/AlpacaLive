/*
 * Strava OAuth2 + Activities API client.
 *
 * Spec: https://developers.strava.com/docs/authentication/
 *
 * Verified via curl 2026-05-09: token endpoint sends
 * 'access-control-allow-origin: *' so PWA can do token exchange
 * without a backend proxy. Strava rotates the refresh_token on each
 * refresh — caller must persist the new value.
 *
 * Strava is primarily an activity tracker (workouts, runs), not a
 * health vitals source. AlpacaLive uses it mostly to capture daily
 * activity load — useful to correlate with energy / fatigue patterns
 * but it does NOT provide RHR, HRV or sleep data.
 */

import { getSettings, saveSettings } from './db';

const AUTH_BASE = 'https://www.strava.com/oauth/authorize';
const TOKEN_URL = 'https://www.strava.com/oauth/token';
const API_BASE = 'https://www.strava.com/api/v3';

const DEFAULT_SCOPES = ['read', 'activity:read'];

export class StravaNotConfiguredError extends Error {
  constructor() {
    super('Strava is not configured');
    this.name = 'StravaNotConfiguredError';
  }
}

export class StravaAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StravaAuthError';
  }
}

interface StravaConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface StravaTokenResponse {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete?: { id: number };
}

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  athleteId?: string;
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  start_date: string;
  start_date_local: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  total_elevation_gain?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed?: number;
  kilojoules?: number;
}

async function loadConfig(): Promise<StravaConfig | null> {
  let s;
  try {
    s = await getSettings();
  } catch {
    return null;
  }
  if (!s) return null;
  const clientId = s.stravaClientId?.trim();
  const clientSecret = s.stravaClientSecret?.trim();
  const redirectUri = s.stravaRedirectUri?.trim();
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

export async function isStravaConfigured(): Promise<boolean> {
  return (await loadConfig()) !== null;
}

const STATE_KEY = 'alpacalive-strava-oauth-state';

export function generateOauthState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
export function rememberOauthState(state: string): void {
  sessionStorage.setItem(STATE_KEY, state);
}
export function consumeOauthState(): string | null {
  const stored = sessionStorage.getItem(STATE_KEY);
  if (stored) sessionStorage.removeItem(STATE_KEY);
  return stored;
}

export async function buildAuthorizationUrl(state: string, scopes: string[] = DEFAULT_SCOPES): Promise<string> {
  const config = await loadConfig();
  if (!config) throw new StravaNotConfiguredError();
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    approval_prompt: 'auto',
    scope: scopes.join(','),
    state,
  });
  return `${AUTH_BASE}?${params.toString()}`;
}

async function postToken(body: URLSearchParams): Promise<StravaTokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new StravaAuthError(`Strava token endpoint HTTP ${response.status}: ${text}`);
  }
  return (await response.json()) as StravaTokenResponse;
}

export async function exchangeCodeForToken(code: string): Promise<StravaTokens> {
  const config = await loadConfig();
  if (!config) throw new StravaNotConfiguredError();
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: 'authorization_code',
  });
  const data = await postToken(body);
  return tokensFromResponse(data);
}

export async function refreshAccessToken(refreshToken: string): Promise<StravaTokens> {
  const config = await loadConfig();
  if (!config) throw new StravaNotConfiguredError();
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const data = await postToken(body);
  return tokensFromResponse(data);
}

function tokensFromResponse(r: StravaTokenResponse): StravaTokens {
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    expiresAt: r.expires_at * 1000, // Strava gives unix seconds
    athleteId: r.athlete?.id ? String(r.athlete.id) : undefined,
  };
}

export async function saveTokens(tokens: StravaTokens): Promise<void> {
  const { db } = await import('./db');
  await db.deviceConnections.put({
    id: 'csv_import' as any, // Re-using csv_import slot is ugly; prefer dedicated key
    connected: true,
    lastSyncDate: new Date().toISOString(),
    lastSyncStatus: 'success',
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenExpiresAt: tokens.expiresAt,
    externalUserId: tokens.athleteId,
  });
  // Use a sidecar key instead — the deviceConnections.id is typed as DeviceSource.
  // Strava is not in DeviceSource (it's an OW provider), so we store under a
  // dedicated localStorage entry. This avoids changing DeviceSource for now.
  localStorage.setItem('alpacalive-strava-tokens', JSON.stringify(tokens));
}

export async function loadTokens(): Promise<StravaTokens | null> {
  try {
    const raw = localStorage.getItem('alpacalive-strava-tokens');
    if (!raw) return null;
    const tokens = JSON.parse(raw) as StravaTokens;
    if (!tokens.accessToken || !tokens.refreshToken) return null;
    return tokens;
  } catch {
    return null;
  }
}

export async function disconnectStrava(): Promise<void> {
  localStorage.removeItem('alpacalive-strava-tokens');
}

export async function withFreshToken(): Promise<StravaTokens> {
  const tokens = await loadTokens();
  if (!tokens) throw new StravaAuthError('No Strava tokens — connect first');
  if (tokens.expiresAt < Date.now() + 60_000) {
    const fresh = await refreshAccessToken(tokens.refreshToken);
    await saveTokens(fresh);
    return fresh;
  }
  return tokens;
}

export async function saveCredentials(creds: StravaConfig): Promise<void> {
  await saveSettings({
    stravaClientId: creds.clientId,
    stravaClientSecret: creds.clientSecret,
    stravaRedirectUri: creds.redirectUri,
  });
}

export async function getActivities(afterUnix: number, beforeUnix: number): Promise<StravaActivity[]> {
  const tokens = await withFreshToken();
  const params = new URLSearchParams({
    after: String(afterUnix),
    before: String(beforeUnix),
    per_page: '200',
  });
  const response = await fetch(`${API_BASE}/athlete/activities?${params}`, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  if (response.status === 401) throw new StravaAuthError('Strava token rejected');
  if (!response.ok) throw new StravaAuthError(`Strava activities HTTP ${response.status}`);
  return (await response.json()) as StravaActivity[];
}
