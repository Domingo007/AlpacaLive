import React from 'react';
import { useI18n } from '@/lib/i18n';
import type { MigrationStatus } from '@/hooks/useDbMigration';

interface MigrationOverlayProps {
  status: MigrationStatus;
}

export function MigrationOverlay({ status }: MigrationOverlayProps) {
  const { t } = useI18n();
  if (status === 'idle') return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#1a0f2e]/90 backdrop-blur-sm
                    flex items-center justify-center p-4">
      <div className="bg-[#2d1f4e] border border-purple-400/20 rounded-2xl
                      p-8 max-w-sm w-full text-center shadow-2xl">

        {status === 'migrating' && (
          <>
            <div className="w-12 h-12 border-4 border-purple-400/30
                            border-t-purple-400 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white font-medium text-lg">
              {t.migration.updating}
            </p>
            <p className="text-purple-200/60 text-sm mt-2">
              {t.migration.dontClose}
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-4xl mb-4">✅</div>
            <p className="text-white font-medium text-lg">
              {t.migration.done}
            </p>
            <p className="text-purple-200/60 text-sm mt-2">
              {t.migration.allGood}
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-4xl mb-4">⚠️</div>
            <p className="text-white font-medium text-lg">
              {t.migration.error}
            </p>
            <p className="text-purple-200/60 text-sm mt-2">
              {t.migration.errorHint}
            </p>
          </>
        )}

      </div>
    </div>
  );
}
