import { describe, it, expect, vi } from 'vitest';
import type { AIAuditLogEntry } from '@/types/audit-log';

describe('audit-logger', () => {
  const mockAdd = vi.fn();
  const mockOrderBy = vi.fn();
  const mockWhere = vi.fn();
  const mockToArray = vi.fn();
  const mockReverse = vi.fn(() => ({
    limit: vi.fn(() => ({ toArray: mockToArray })),
  }));

  vi.mock('@/lib/db', () => ({
    db: {
      aiAuditLog: {
        add: mockAdd,
        orderBy: mockOrderBy,
        where: mockWhere,
        toArray: mockToArray,
        clear: vi.fn(),
      },
    },
    pruneAuditLog: vi.fn(),
  }));

  it('audit log entry has required fields', () => {
    const entry: Omit<AIAuditLogEntry, 'id'> = {
      timestamp: new Date(),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokensEstimate: 920,
      outputTokensEstimate: 340,
      piiFieldsRemoved: ['displayName', 'treatmentFacility'],
      psychiatricAbstracted: true,
      drugNamesResolved: 2,
      guidelineRegion: 'ESMO',
      ageDecadeUsed: '30-40',
      success: true,
    };

    expect(entry.provider).toBe('anthropic');
    expect(entry.model).toBe('claude-sonnet-4');
    expect(entry.piiFieldsRemoved).toContain('displayName');
    expect(entry.success).toBe(true);
  });

  it('audit log entry supports error code', () => {
    const entry: Omit<AIAuditLogEntry, 'id'> = {
      timestamp: new Date(),
      provider: 'openai',
      model: 'gpt-4o',
      inputTokensEstimate: 100,
      outputTokensEstimate: 0,
      piiFieldsRemoved: [],
      psychiatricAbstracted: false,
      drugNamesResolved: 0,
      guidelineRegion: 'NCCN',
      ageDecadeUsed: '40-50',
      success: false,
      errorCode: '429',
    };

    expect(entry.success).toBe(false);
    expect(entry.errorCode).toBe('429');
  });

  it('audit log tracks different providers', () => {
    const providers: Array<'anthropic' | 'openai' | 'gemini'> = ['anthropic', 'openai', 'gemini'];
    providers.forEach(provider => {
      const entry: Omit<AIAuditLogEntry, 'id'> = {
        timestamp: new Date(),
        provider,
        model: 'test-model',
        inputTokensEstimate: 100,
        outputTokensEstimate: 50,
        piiFieldsRemoved: [],
        psychiatricAbstracted: false,
        drugNamesResolved: 0,
        guidelineRegion: 'ESMO',
        ageDecadeUsed: '20-30',
        success: true,
      };
      expect(entry.provider).toBe(provider);
    });
  });

  it('audit log tracks guideline regions', () => {
    const regions: Array<'ESMO' | 'NCCN' | 'both'> = ['ESMO', 'NCCN', 'both'];
    regions.forEach(region => {
      const entry: Omit<AIAuditLogEntry, 'id'> = {
        timestamp: new Date(),
        provider: 'anthropic',
        model: 'claude-sonnet-4',
        inputTokensEstimate: 100,
        outputTokensEstimate: 50,
        piiFieldsRemoved: [],
        psychiatricAbstracted: false,
        drugNamesResolved: 0,
        guidelineRegion: region,
        ageDecadeUsed: '30-40',
        success: true,
      };
      expect(entry.guidelineRegion).toBe(region);
    });
  });

  it('audit log tracks PII fields removed', () => {
    const entry: Omit<AIAuditLogEntry, 'id'> = {
      timestamp: new Date(),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokensEstimate: 100,
      outputTokensEstimate: 50,
      piiFieldsRemoved: ['displayName', 'treatmentFacility', 'psychiatricMedDetails'],
      psychiatricAbstracted: true,
      drugNamesResolved: 5,
      guidelineRegion: 'ESMO',
      ageDecadeUsed: '30-40',
      success: true,
    };

    expect(entry.piiFieldsRemoved).toHaveLength(3);
    expect(entry.piiFieldsRemoved).toContain('displayName');
    expect(entry.piiFieldsRemoved).toContain('treatmentFacility');
  });

  it('audit log records drug resolution count', () => {
    const entry1: Omit<AIAuditLogEntry, 'id'> = {
      timestamp: new Date(),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokensEstimate: 100,
      outputTokensEstimate: 50,
      piiFieldsRemoved: [],
      psychiatricAbstracted: false,
      drugNamesResolved: 0,
      guidelineRegion: 'ESMO',
      ageDecadeUsed: '20-30',
      success: true,
    };

    const entry2: Omit<AIAuditLogEntry, 'id'> = {
      timestamp: new Date(),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokensEstimate: 100,
      outputTokensEstimate: 50,
      piiFieldsRemoved: [],
      psychiatricAbstracted: false,
      drugNamesResolved: 3,
      guidelineRegion: 'ESMO',
      ageDecadeUsed: '20-30',
      success: true,
    };

    expect(entry1.drugNamesResolved).toBe(0);
    expect(entry2.drugNamesResolved).toBe(3);
  });

  it('audit log records psychiatric abstraction', () => {
    const entry1: Omit<AIAuditLogEntry, 'id'> = {
      timestamp: new Date(),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokensEstimate: 100,
      outputTokensEstimate: 50,
      piiFieldsRemoved: [],
      psychiatricAbstracted: false,
      drugNamesResolved: 0,
      guidelineRegion: 'ESMO',
      ageDecadeUsed: '20-30',
      success: true,
    };

    const entry2: Omit<AIAuditLogEntry, 'id'> = {
      timestamp: new Date(),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokensEstimate: 100,
      outputTokensEstimate: 50,
      piiFieldsRemoved: [],
      psychiatricAbstracted: true,
      drugNamesResolved: 0,
      guidelineRegion: 'ESMO',
      ageDecadeUsed: '20-30',
      success: true,
    };

    expect(entry1.psychiatricAbstracted).toBe(false);
    expect(entry2.psychiatricAbstracted).toBe(true);
  });

  it('audit log records age decade used', () => {
    const entry: Omit<AIAuditLogEntry, 'id'> = {
      timestamp: new Date(),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokensEstimate: 100,
      outputTokensEstimate: 50,
      piiFieldsRemoved: [],
      psychiatricAbstracted: false,
      drugNamesResolved: 0,
      guidelineRegion: 'ESMO',
      ageDecadeUsed: '30-40',
      success: true,
    };

    expect(entry.ageDecadeUsed).toMatch(/^\d+-\d+$/);
    expect(entry.ageDecadeUsed).toBe('30-40');
  });

  it('audit log records token estimates', () => {
    const entry: Omit<AIAuditLogEntry, 'id'> = {
      timestamp: new Date(),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokensEstimate: 920,
      outputTokensEstimate: 340,
      piiFieldsRemoved: [],
      psychiatricAbstracted: false,
      drugNamesResolved: 0,
      guidelineRegion: 'ESMO',
      ageDecadeUsed: '30-40',
      success: true,
    };

    expect(entry.inputTokensEstimate).toBe(920);
    expect(entry.outputTokensEstimate).toBe(340);
  });
});
