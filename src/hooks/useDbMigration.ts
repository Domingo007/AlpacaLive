import { useEffect, useState, useCallback } from 'react';

export type MigrationStatus = 'idle' | 'migrating' | 'success' | 'error';

export function useDbMigration() {
  const [status, setStatus] = useState<MigrationStatus>('idle');
  const [fromVersion, setFromVersion] = useState<number | null>(null);
  const [toVersion, setToVersion] = useState<number | null>(null);

  const setSuccess = useCallback(() => {
    setStatus('success');
    setTimeout(() => setStatus('idle'), 4000);
  }, []);

  useEffect(() => {
    const onMigrating = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setFromVersion(detail.from);
      setToVersion(detail.to);
      setStatus('migrating');
    };
    const onMigrated = () => setSuccess();
    const onError = () => setStatus('error');

    window.addEventListener('alpaca:db:migrating', onMigrating);
    window.addEventListener('alpaca:db:migrated', onMigrated);
    window.addEventListener('alpaca:db:migration-error', onError);

    return () => {
      window.removeEventListener('alpaca:db:migrating', onMigrating);
      window.removeEventListener('alpaca:db:migrated', onMigrated);
      window.removeEventListener('alpaca:db:migration-error', onError);
    };
  }, [setSuccess]);

  return { status, fromVersion, toVersion };
}
