import { useState, type ReactNode } from 'react';
import { Icon } from '@/components/shared/Icon';

/**
 * Collapsible "Advanced" section. Used to hide power-user integrations
 * (currently: self-hosted Open Wearables) below the simple Oura / Withings
 * / Strava cards. Closed by default — only opens for users who actively
 * want self-hosted control.
 */
export function AdvancedSection({ title, subtitle, children }: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-bg-card rounded-2xl border border-lavender-100 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-lavender-50 transition-colors"
        aria-expanded={open}
      >
        <Icon name="settings" size={22} className="text-lavender-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-text-primary">{title}</div>
          {subtitle && <div className="text-[11px] text-text-secondary mt-0.5">{subtitle}</div>}
        </div>
        <Icon name={open ? 'expand_less' : 'expand_more'} size={20} className="text-text-tertiary" />
      </button>
      {open && <div className="px-5 pb-5 space-y-4">{children}</div>}
    </div>
  );
}
