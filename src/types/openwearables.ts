/*
 * Open Wearables — types for the unified wearables API.
 *
 * AlpacaLive uses Open Wearables (https://openwearables.io) as the primary
 * data ingestion layer for cloud OAuth wearables. We consume only the
 * data layer — Health Scores, Recovery Scores and Coaching Profiles are
 * deliberately ignored to keep AlpacaLive below the MDR medical-device
 * threshold (own daily-profile + pattern-engine remain authoritative).
 *
 * Native-only providers (Apple Health, Samsung Health, Google Health Connect)
 * are intentionally absent from this enum: they require platform SDKs and
 * are not reachable from a PWA web app.
 */

export type OpenWearablesProvider =
  | 'whoop'
  | 'garmin'
  | 'oura'
  | 'polar'
  | 'suunto'
  | 'strava'
  | 'ultrahuman';

export const OPEN_WEARABLES_PROVIDERS: OpenWearablesProvider[] = [
  'oura',
  'whoop',
  'ultrahuman',
  'garmin',
  'polar',
  'suunto',
  'strava',
];

export interface OWConnection {
  provider: OpenWearablesProvider;
  connectedAt: string;
  lastSync?: string;
  status: 'active' | 'disconnected' | 'error';
}

/** Raw activity summary returned by GET /api/v1/users/{id}/summaries/activity */
export interface OWActivitySummary {
  date: string;
  source: OpenWearablesProvider;
  steps?: number;
  activeMinutes?: number;
  caloriesActive?: number;
  raw?: Record<string, unknown>;
}

/** Raw sleep summary returned by GET /api/v1/users/{id}/summaries/sleep */
export interface OWSleepSummary {
  date: string;
  source: OpenWearablesProvider;
  durationMinutes?: number;
  efficiency?: number;
  deepMinutes?: number;
  remMinutes?: number;
  lightMinutes?: number;
  awakeMinutes?: number;
  raw?: Record<string, unknown>;
}

/** Raw body summary returned by GET /api/v1/users/{id}/summaries/body */
export interface OWBodySummary {
  date: string;
  source: OpenWearablesProvider;
  weightKg?: number;
  bodyFatPercent?: number;
  musclePercent?: number;
  raw?: Record<string, unknown>;
}

/** Raw recovery summary returned by GET /api/v1/users/{id}/summaries/recovery */
export interface OWRecoverySummary {
  date: string;
  source: OpenWearablesProvider;
  restingHeartRate?: number;
  hrvMs?: number;
  spo2Percent?: number;
  skinTemperatureDelta?: number;
  raw?: Record<string, unknown>;
}

/**
 * Unified per-day summary produced by mergeProviderSummaries.
 * Single source per day after priority resolution.
 */
export interface OWUnifiedDailySummary {
  date: string;
  source: OpenWearablesProvider;
  rhr?: number;
  hrv?: number;
  spo2?: number;
  skinTemperature?: number;
  sleepHours?: number;
  deepSleep?: number;
  remSleep?: number;
  lightSleep?: number;
  steps?: number;
  activeMinutes?: number;
  weightKg?: number;
  bodyFatPercent?: number;
  musclePercent?: number;
}

export class OpenWearablesNotConfiguredError extends Error {
  constructor() {
    super('Open Wearables is not configured');
    this.name = 'OpenWearablesNotConfiguredError';
  }
}

export class OpenWearablesAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenWearablesAuthError';
  }
}

export class OpenWearablesServerError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'OpenWearablesServerError';
  }
}
