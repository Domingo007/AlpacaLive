import { Icon } from './Icon';
import { useI18n } from '@/lib/i18n';

interface Props {
  context: 'chat' | 'form';
  unknownDrugs: string[];
  onReport: (drugs: string[]) => void;
  onDismiss: () => void;
  onCancel?: () => void;
  onRemove?: (drug: string) => void;
}

export function UnknownDrugBubble({ context, unknownDrugs, onReport, onDismiss, onCancel, onRemove }: Props) {
  const { t } = useI18n();

  if (unknownDrugs.length === 0) return null;

  if (context === 'chat') {
    const drug = unknownDrugs[0];
    const copy = t.unknownDrug.chat;
    return (
      <div
        role="status"
        aria-live="polite"
        className="mb-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs"
      >
        <div className="flex items-start gap-2">
          <Icon name="search_off" size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-text-primary">{copy.title(drug)}</div>
            <p className="text-text-secondary mt-0.5">{copy.description}</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => onReport([drug])}
                className="bg-accent-dark text-accent-warm rounded-lg px-3 py-1 text-xs font-medium"
              >
                {copy.reportButton}
              </button>
              <button
                onClick={onDismiss}
                className="text-text-secondary px-3 py-1 text-xs"
              >
                {copy.dismissButton}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const copy = t.unknownDrug.form;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.title(unknownDrugs.length)}
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
    >
      <div className="bg-bg-primary rounded-2xl border border-border w-full max-w-md p-4 shadow-xl">
        <div className="flex items-start gap-2 mb-3">
          <Icon name="medication" size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-text-primary">{copy.title(unknownDrugs.length)}</h3>
            <p className="text-xs text-text-secondary mt-1">{copy.description}</p>
          </div>
          <button
            onClick={onCancel ?? onDismiss}
            aria-label={copy.closeAriaLabel}
            className="text-text-tertiary p-0.5 -mt-0.5"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <ul className="space-y-1 mb-4 max-h-48 overflow-y-auto">
          {unknownDrugs.map(drug => (
            <li
              key={drug}
              className="flex items-center justify-between gap-2 bg-bg-card rounded-lg border border-border px-3 py-1.5 text-xs"
            >
              <span className="font-mono">{drug}</span>
              {onRemove && unknownDrugs.length > 1 && (
                <button
                  onClick={() => onRemove(drug)}
                  aria-label={copy.removeAriaLabel(drug)}
                  className="text-text-tertiary hover:text-alert-critical"
                >
                  <Icon name="close" size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => onReport(unknownDrugs)}
            className="w-full bg-accent-dark text-accent-warm rounded-xl py-2.5 text-sm font-medium"
          >
            {copy.reportButton}
          </button>
          <button
            onClick={onDismiss}
            className="w-full border border-border text-text-secondary rounded-xl py-2.5 text-sm"
          >
            {copy.continueButton}
          </button>
        </div>
      </div>
    </div>
  );
}
