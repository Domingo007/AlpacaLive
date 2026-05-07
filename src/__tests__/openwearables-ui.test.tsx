// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n';

// Mock client and adapter BEFORE importing components
const clientState = vi.hoisted(() => ({
  isConfigured: false,
  connections: [] as any[],
  startConnect: { error: null as Error | null, url: 'https://provider.example/oauth' },
  syncResult: { success: true, syncedDays: 7, providers: ['oura'] as string[], errors: [] as string[] },
}));

vi.mock('@/lib/openwearables-client', () => ({
  openWearablesClient: {
    isConfigured: async () => clientState.isConfigured,
    listConnections: async () => clientState.connections,
    startConnect: async (provider: string) => {
      if (clientState.startConnect.error) throw clientState.startConnect.error;
      return { authorizationUrl: `${clientState.startConnect.url}#${provider}` };
    },
  },
}));

vi.mock('@/lib/openwearables-adapter', () => ({
  syncOpenWearables: async () => clientState.syncResult,
}));

// Avoid Dexie boot in jsdom
vi.mock('@/lib/db', () => ({
  getSettings: async () => undefined,
  saveSettings: async () => {},
}));

import { OpenWearablesConnectModal } from '@/components/settings/OpenWearablesConnectModal';
import { OpenWearablesStatus } from '@/components/dashboard/OpenWearablesStatus';

function renderInI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe('OpenWearablesConnectModal', () => {
  beforeEach(() => {
    clientState.isConfigured = true;
    clientState.connections = [];
    clientState.startConnect = { error: null, url: 'https://provider.example/oauth' };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders all 7 cloud providers when configured', async () => {
    renderInI18n(<OpenWearablesConnectModal open={true} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Oura Ring')).toBeInTheDocument();
    });
    expect(screen.getByText('Whoop')).toBeInTheDocument();
    expect(screen.getByText('Ultrahuman')).toBeInTheDocument();
    expect(screen.getByText('Garmin')).toBeInTheDocument();
    expect(screen.getByText('Polar')).toBeInTheDocument();
    expect(screen.getByText('Suunto')).toBeInTheDocument();
    expect(screen.getByText('Strava')).toBeInTheDocument();
  });

  it('shows the not_configured banner when client is not configured', async () => {
    clientState.isConfigured = false;
    renderInI18n(<OpenWearablesConnectModal open={true} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/not configured/i)).toBeInTheDocument();
    });
  });

  it('shows native-only notice (Apple Health/Samsung/Health Connect)', async () => {
    renderInI18n(<OpenWearablesConnectModal open={true} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/Apple Health, Samsung Health and Google Health Connect/i)).toBeInTheDocument();
    });
  });

  it('opens authorization URL on Connect click', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderInI18n(<OpenWearablesConnectModal open={true} onClose={() => {}} />);
    await waitFor(() => screen.getByText('Oura Ring'));

    const connectButtons = screen.getAllByRole('button', { name: /^Connect$/i });
    fireEvent.click(connectButtons[0]);

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://provider.example/oauth#oura'),
        '_blank',
        expect.any(String)
      );
    });
    openSpy.mockRestore();
  });

  it('Escape key calls onClose', async () => {
    const onClose = vi.fn();
    renderInI18n(<OpenWearablesConnectModal open={true} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when open=false', () => {
    const { container } = renderInI18n(
      <OpenWearablesConnectModal open={false} onClose={() => {}} />
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});

describe('OpenWearablesStatus', () => {
  beforeEach(() => {
    clientState.isConfigured = false;
    clientState.connections = [];
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders nothing when client is not configured (silent-fail per CLAUDE.md)', async () => {
    clientState.isConfigured = false;
    const { container } = renderInI18n(<OpenWearablesStatus />);
    // Initial render is null (configured=null), then becomes null again
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('shows empty state with manage button when configured but no devices', async () => {
    clientState.isConfigured = true;
    clientState.connections = [];
    renderInI18n(<OpenWearablesStatus />);
    await waitFor(() => {
      expect(screen.getByText('Open Wearables')).toBeInTheDocument();
    });
    expect(screen.getByText(/Connect a wearable to enrich/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Manage/i })).toBeInTheDocument();
  });

  it('shows connection count when devices are connected', async () => {
    clientState.isConfigured = true;
    clientState.connections = [
      { provider: 'oura', connectedAt: '2026-05-01', status: 'active' },
      { provider: 'garmin', connectedAt: '2026-05-02', status: 'active' },
    ];
    renderInI18n(<OpenWearablesStatus />);
    await waitFor(() => {
      expect(screen.getByText(/2 devices connected/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /^Sync$/i })).toBeInTheDocument();
  });
});
