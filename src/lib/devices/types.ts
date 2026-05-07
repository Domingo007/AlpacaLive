/*
 * AlpacaLive — Device integration types
 * Shared types for all device data sources.
 */

export type DeviceSource = 'apple_health' | 'health_connect' | 'withings' | 'garmin' | 'csv_import' | 'open_wearables';

export interface DeviceConnection {
  id: DeviceSource;
  connected: boolean;
  lastSyncDate?: string;
  lastSyncStatus?: 'success' | 'error';
  errorMessage?: string;
  // OAuth tokens (Withings)
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  externalUserId?: string;
}

/**
 * Unified data format produced by all device importers.
 * Maps to WearableData + DailyLog fields.
 */
export interface NormalizedDeviceData {
  date: string;
  source: DeviceSource;
  // WearableData fields
  rhr?: number;
  hrv?: number;
  spo2?: number;
  sleepHours?: number;
  deepSleep?: number;
  remSleep?: number;
  lightSleep?: number;
  steps?: number;
  activeMinutes?: number;
  skinTemperature?: number;
  respiratoryRate?: number;
  stressLevel?: number;
  biocharge?: number;
  // Body composition
  bodyFatPercent?: number;
  musclePercent?: number;
  // DailyLog fields
  weight?: number;
  temperature?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  heartRate?: number;
}

export interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface ImportPreviewData {
  rows: NormalizedDeviceData[];
  source: DeviceSource;
  dateRange: { from: string; to: string };
  duplicateCount: number;
  newCount: number;
}
