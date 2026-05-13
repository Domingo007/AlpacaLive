import { db, pruneAuditLog } from './db';
import type { AIAuditLogEntry } from '@/types/audit-log';

export async function logAICall(entry: Omit<AIAuditLogEntry, 'id'>): Promise<void> {
  try {
    await db.aiAuditLog.add(entry);
    if (Math.random() < 0.1) {
      await pruneAuditLog(90);
    }
  } catch (err) {
    console.warn('[AuditLog] Failed to save entry:', err);
  }
}

export async function getAuditLog(limit = 50): Promise<AIAuditLogEntry[]> {
  return db.aiAuditLog.orderBy('timestamp').reverse().limit(limit).toArray();
}

export async function getAuditStats(): Promise<{
  totalCalls: number;
  last30Days: number;
  byProvider: Record<string, number>;
  avgInputTokens: number;
}> {
  const all = await db.aiAuditLog.toArray();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const last30 = all.filter(e => e.timestamp > cutoff);
  const byProvider: Record<string, number> = {};
  all.forEach(e => {
    byProvider[e.provider] = (byProvider[e.provider] ?? 0) + 1;
  });
  const avgInput = all.length
    ? Math.round(all.reduce((s, e) => s + e.inputTokensEstimate, 0) / all.length)
    : 0;

  return {
    totalCalls: all.length,
    last30Days: last30.length,
    byProvider,
    avgInputTokens: avgInput,
  };
}
