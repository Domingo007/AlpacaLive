/*
 * Oura API v2 client (Personal Access Token flow).
 *
 * Spec: https://cloud.ouraring.com/v2/docs
 *
 * UX choice: we use Personal Access Tokens (PAT), not OAuth. The user
 * generates a PAT at cloud.ouraring.com/personal-access-tokens and
 * pastes it into AlpacaLive — exactly the same friction level as the
 * Anthropic API key. No OAuth dance, no client secret, no callback URI.
 *
 * CORS: api.ouraring.com sets access-control-allow-credentials:true
 * and allow-headers:authorization (verified via curl 2026-05-09).
 * Browser fetch from a PWA works fine.
 */

import { getSettings } from './db';

const API_BASE = 'https://api.ouraring.com/v2';

export class OuraNotConfiguredError extends Error {
  constructor() {
    super('Oura is not configured');
    this.name = 'OuraNotConfiguredError';
  }
}

export class OuraAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OuraAuthError';
  }
}

export interface OuraDailySleep {
  id: string;
  day: string;
  score?: number;
  contributors?: Record<string, number>;
}

export interface OuraSleepSession {
  id: string;
  day: string;
  total_sleep_duration?: number; // seconds
  deep_sleep_duration?: number;
  rem_sleep_duration?: number;
  light_sleep_duration?: number;
  awake_time?: number;
  efficiency?: number;
  average_heart_rate?: number;
  lowest_heart_rate?: number;
  average_hrv?: number;
  bedtime_start?: string;
  bedtime_end?: string;
}

export interface OuraDailyReadiness {
  id: string;
  day: string;
  score?: number;
  temperature_deviation?: number;
  temperature_trend_deviation?: number;
}

export interface OuraDailyActivity {
  id: string;
  day: string;
  steps?: number;
  active_calories?: number;
  total_calories?: number;
  high_activity_time?: number;
  medium_activity_time?: number;
  low_activity_time?: number;
}

export interface OuraDailySpO2 {
  id: string;
  day: string;
  spo2_percentage?: { average?: number };
}

interface OuraListResponse<T> {
  data: T[];
  next_token?: string | null;
}

export class OuraClient {
  private overrideToken?: string;

  setToken(token: string | undefined): void {
    this.overrideToken = token;
  }

  async getToken(): Promise<string | null> {
    if (this.overrideToken !== undefined) return this.overrideToken || null;
    let settings;
    try {
      settings = await getSettings();
    } catch {
      return null;
    }
    return settings?.ouraPersonalAccessToken?.trim() || null;
  }

  async isConfigured(): Promise<boolean> {
    return (await this.getToken()) !== null;
  }

  /** Quick health check — fetches /personal_info, returns true on 200. */
  async ping(): Promise<boolean> {
    try {
      await this.fetch('/usercollection/personal_info');
      return true;
    } catch {
      return false;
    }
  }

  async getDailySleep(start: string, end: string): Promise<OuraDailySleep[]> {
    return this.list<OuraDailySleep>('/usercollection/daily_sleep', start, end);
  }

  async getSleepSessions(start: string, end: string): Promise<OuraSleepSession[]> {
    return this.list<OuraSleepSession>('/usercollection/sleep', start, end);
  }

  async getDailyReadiness(start: string, end: string): Promise<OuraDailyReadiness[]> {
    return this.list<OuraDailyReadiness>('/usercollection/daily_readiness', start, end);
  }

  async getDailyActivity(start: string, end: string): Promise<OuraDailyActivity[]> {
    return this.list<OuraDailyActivity>('/usercollection/daily_activity', start, end);
  }

  async getDailySpO2(start: string, end: string): Promise<OuraDailySpO2[]> {
    return this.list<OuraDailySpO2>('/usercollection/daily_spo2', start, end);
  }

  private async list<T>(path: string, start: string, end: string): Promise<T[]> {
    const params = new URLSearchParams({ start_date: start, end_date: end });
    const data = await this.fetch<OuraListResponse<T>>(`${path}?${params.toString()}`);
    return data.data ?? [];
  }

  private async fetch<T>(path: string): Promise<T> {
    const token = await this.getToken();
    if (!token) throw new OuraNotConfiguredError();
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (response.status === 401 || response.status === 403) {
      throw new OuraAuthError(`Oura auth failed (${response.status})`);
    }
    if (!response.ok) {
      throw new OuraAuthError(`Oura HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  }
}

export const ouraClient = new OuraClient();
