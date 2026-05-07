/*
 * Open Wearables REST client (browser-side).
 *
 * Spec source: https://openwearables.io/docs/api-reference/introduction
 * Auth header: X-Open-Wearables-API-Key (NOT Authorization: Bearer).
 *
 * Configuration lives in AppSettings (Dexie) — same convention as the
 * Anthropic API key. There is no env-var path; users self-host their
 * Open Wearables instance and paste the URL + API key into Settings.
 *
 * Each method gates behind isConfigured(); callers should catch
 * OpenWearablesNotConfiguredError and degrade silently.
 */

import { getSettings } from './db';
import {
  OpenWearablesAuthError,
  OpenWearablesNotConfiguredError,
  OpenWearablesServerError,
  type OWActivitySummary,
  type OWBodySummary,
  type OWConnection,
  type OWRecoverySummary,
  type OWSleepSummary,
  type OpenWearablesProvider,
} from '@/types/openwearables';

interface ClientConfig {
  baseUrl: string;
  apiKey: string;
  userId: string;
}

export class OpenWearablesClient {
  private overrideConfig?: ClientConfig;

  /** Allow tests/explicit callers to inject config without hitting Dexie. */
  setConfig(config: ClientConfig | undefined): void {
    this.overrideConfig = config;
  }

  async getConfig(): Promise<ClientConfig | null> {
    if (this.overrideConfig) return this.overrideConfig;
    let settings;
    try {
      settings = await getSettings();
    } catch {
      return null;
    }
    if (!settings) return null;
    const baseUrl = settings.openWearablesBaseUrl?.trim();
    const apiKey = settings.openWearablesApiKey?.trim();
    const userId = settings.openWearablesUserId?.trim();
    if (!baseUrl || !apiKey || !userId) return null;
    return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey, userId };
  }

  async isConfigured(): Promise<boolean> {
    return (await this.getConfig()) !== null;
  }

  async startConnect(provider: OpenWearablesProvider): Promise<{ authorizationUrl: string }> {
    const config = await this.requireConfig();
    const url = `${config.baseUrl}/api/v1/oauth/${provider}/authorize?user_id=${encodeURIComponent(config.userId)}`;
    const data = await this.request<{ authorization_url?: string; authorizationUrl?: string }>(url, {
      method: 'GET',
    });
    const authorizationUrl = data.authorizationUrl ?? data.authorization_url;
    if (!authorizationUrl) {
      throw new OpenWearablesServerError('Open Wearables did not return an authorization URL', 200);
    }
    return { authorizationUrl };
  }

  async listConnections(): Promise<OWConnection[]> {
    const config = await this.requireConfig();
    const url = `${config.baseUrl}/api/v1/users/${encodeURIComponent(config.userId)}/connections`;
    const data = await this.request<{ connections?: OWConnection[]; data?: OWConnection[] }>(url, {
      method: 'GET',
    });
    return data.connections ?? data.data ?? [];
  }

  async getActivity(start: string, end: string): Promise<OWActivitySummary[]> {
    return this.fetchSummary<OWActivitySummary>('activity', start, end);
  }

  async getSleep(start: string, end: string): Promise<OWSleepSummary[]> {
    return this.fetchSummary<OWSleepSummary>('sleep', start, end);
  }

  async getBody(start: string, end: string): Promise<OWBodySummary[]> {
    return this.fetchSummary<OWBodySummary>('body', start, end);
  }

  async getRecovery(start: string, end: string): Promise<OWRecoverySummary[]> {
    return this.fetchSummary<OWRecoverySummary>('recovery', start, end);
  }

  private async fetchSummary<T>(
    kind: 'activity' | 'sleep' | 'body' | 'recovery',
    start: string,
    end: string
  ): Promise<T[]> {
    const config = await this.requireConfig();
    const params = new URLSearchParams({ start_date: start, end_date: end });
    const url = `${config.baseUrl}/api/v1/users/${encodeURIComponent(config.userId)}/summaries/${kind}?${params}`;
    const data = await this.request<{ data?: T[]; summaries?: T[] }>(url, { method: 'GET' });
    return data.data ?? data.summaries ?? [];
  }

  private async requireConfig(): Promise<ClientConfig> {
    const config = await this.getConfig();
    if (!config) throw new OpenWearablesNotConfiguredError();
    return config;
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    const config = await this.requireConfig();
    const response = await fetch(url, {
      ...init,
      headers: {
        'X-Open-Wearables-API-Key': config.apiKey,
        Accept: 'application/json',
        ...(init.headers ?? {}),
      },
    });
    if (response.status === 401 || response.status === 403) {
      throw new OpenWearablesAuthError(`Open Wearables auth failed (${response.status})`);
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new OpenWearablesServerError(
        `Open Wearables ${response.status}: ${body || response.statusText}`,
        response.status
      );
    }
    return (await response.json()) as T;
  }
}

export const openWearablesClient = new OpenWearablesClient();
