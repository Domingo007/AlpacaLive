import { useState, type ReactNode } from 'react';
import { Icon } from '@/components/shared/Icon';

/**
 * Collapsible setup guide block, placed inside each integration card.
 * Closed by default — only opens when the user wants help. Renders a
 * numbered step list. Caller passes the rendered step content (so PL/EN
 * copy lives next to the rest of the card's translations).
 */
export function SetupGuide({
  title,
  steps,
}: {
  title: string;
  steps: ReactNode[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-bg-primary border border-lavender-100 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-lavender-50 transition-colors"
        aria-expanded={open}
      >
        <Icon name="help_outline" size={16} className="text-lavender-600" />
        <span className="text-[12px] font-semibold text-text-primary flex-1">{title}</span>
        <Icon
          name={open ? 'expand_less' : 'expand_more'}
          size={18}
          className="text-text-tertiary"
        />
      </button>
      {open && (
        <ol className="px-4 pb-3 pt-1 space-y-2 list-none">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-2 items-start text-[11px] leading-relaxed text-text-secondary">
              <span className="shrink-0 w-5 h-5 rounded-full bg-lavender-200 text-lavender-800 text-[10px] font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <div className="flex-1">{step}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
