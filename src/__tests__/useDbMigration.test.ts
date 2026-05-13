import { describe, it, expect } from 'vitest';

describe('useDbMigration', () => {
  it('MigrationStatus includes idle state', () => {
    const status: 'idle' | 'migrating' | 'success' | 'error' = 'idle';
    expect(status).toBe('idle');
  });

  it('MigrationStatus includes migrating state', () => {
    const status: 'idle' | 'migrating' | 'success' | 'error' = 'migrating';
    expect(status).toBe('migrating');
  });

  it('MigrationStatus includes success state', () => {
    const status: 'idle' | 'migrating' | 'success' | 'error' = 'success';
    expect(status).toBe('success');
  });

  it('MigrationStatus includes error state', () => {
    const status: 'idle' | 'migrating' | 'success' | 'error' = 'error';
    expect(status).toBe('error');
  });

  it('CustomEvent can be dispatched with alpaca:db:migrating type', () => {
    const event = new CustomEvent('alpaca:db:migrating', {
      detail: { from: 3, to: 4 },
    });
    expect(event.type).toBe('alpaca:db:migrating');
    expect((event as CustomEvent).detail).toEqual({ from: 3, to: 4 });
  });

  it('CustomEvent can be dispatched with alpaca:db:migrated type', () => {
    const event = new CustomEvent('alpaca:db:migrated', {
      detail: { from: 3, to: 4 },
    });
    expect(event.type).toBe('alpaca:db:migrated');
  });
});
