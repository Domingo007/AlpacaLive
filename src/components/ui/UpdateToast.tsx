import React from 'react';
import { useI18n } from '@/lib/i18n';

interface UpdateToastProps {
  onUpdate: () => void;
  onDismiss: () => void;
}

export function UpdateToast({ onUpdate, onDismiss }: UpdateToastProps) {
  const { t } = useI18n();

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50
                    bg-[#2d1f4e] border border-purple-400/30 rounded-xl
                    px-5 py-4 shadow-2xl max-w-sm w-full mx-4">
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5">🦙</span>
        <div className="flex-1">
          <p className="text-white text-sm font-medium">
            {t.update.available}
          </p>
          <p className="text-purple-200/70 text-xs mt-0.5">
            {t.update.dataPreserved}
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={onUpdate}
          className="flex-1 bg-purple-500 hover:bg-purple-400
                     text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors"
        >
          {t.update.updateNow}
        </button>
        <button
          onClick={onDismiss}
          className="text-purple-300/60 hover:text-purple-300
                     text-sm py-2 px-3 rounded-lg transition-colors"
        >
          {t.update.later}
        </button>
      </div>
    </div>
  );
}
