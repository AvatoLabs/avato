/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Version from './Version';

const mockMessageError = vi.hoisted(() => vi.fn());
const mockCheckUpdate = vi.hoisted(() => vi.fn());
const mockInstallNow = vi.hoisted(() => vi.fn());
const mockGetUpdaterState = vi.hoisted(() => vi.fn());
const mockGetBuildChannel = vi.hoisted(() => vi.fn());
const globalStoreState = vi.hoisted(() => ({
  latestVersion: '2.0.0',
  serverVersion: '1.0.0',
  useCheckServerVersion: vi.fn(),
}));

vi.mock('@lobechat/business-const', () => ({
  BRANDING_NAME: 'LobeHub',
}));

vi.mock('@lobechat/electron-client-ipc', () => ({
  getElectronIpc: () => ({}),
  useWatchBroadcast: vi.fn(),
}));

vi.mock('@lobehub/ui', () => ({
  Block: ({ children }: any) => <div>{children}</div>,
  Button: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Tag: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: mockMessageError,
      },
    }),
  },
}));

vi.mock('antd-style', () => ({
  createStaticStyles: (factory: any) =>
    factory({
      css: () => '',
      cssVar: {
        borderRadiusLG: '8px',
      },
    }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/Branding', () => ({
  ProductLogo: () => null,
}));

vi.mock('@/const/url', () => ({
  CHANGELOG_URL: 'https://example.com/changelog',
  GITHUB: 'https://github.com/lobehub/lobe-chat',
  MANUAL_UPGRADE_URL: 'https://example.com/upgrade',
}));

vi.mock('@/const/version', () => ({
  CURRENT_VERSION: '1.0.0',
}));

vi.mock('@/features/User/UserPanel/useNewVersion', () => ({
  useNewVersion: () => false,
}));

vi.mock('@/services/electron/autoUpdate', () => ({
  autoUpdateService: {
    checkUpdate: mockCheckUpdate,
    getBuildChannel: mockGetBuildChannel,
    getUpdaterState: mockGetUpdaterState,
    installNow: mockInstallNow,
  },
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: (selector: any) => selector(globalStoreState),
}));

describe('Version', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUpdaterState.mockResolvedValue({ stage: 'idle' });
    mockGetBuildChannel.mockResolvedValue('stable');
  });

  it('shows an error when checking for updates fails', async () => {
    const error = new Error('check failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCheckUpdate.mockRejectedValue(error);

    render(<Version />);

    fireEvent.click(screen.getByRole('button', { name: 'checkForUpdates' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('updater.updateError');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to check for updates:', error);

    consoleErrorSpy.mockRestore();
  });

  it('shows an error when installing an update fails', async () => {
    const error = new Error('install failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetUpdaterState.mockResolvedValue({ stage: 'downloaded' });
    mockInstallNow.mockRejectedValue(error);

    render(<Version />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'restartToUpdate' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'restartToUpdate' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('updater.updateError');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to install update:', error);

    consoleErrorSpy.mockRestore();
  });
});
