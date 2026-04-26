/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ActionButton from './index';

const mockMessageError = vi.hoisted(() => vi.fn());
const marketAuthState = vi.hoisted(() => ({
  isAuthenticated: true,
  isLoading: false,
  signIn: vi.fn(),
}));
const detailContextState = vi.hoisted(() => ({
  haveCloudEndpoint: false,
  identifier: 'mcp-plugin',
}));
const toolStoreState = vi.hoisted(() => ({
  installMCPPlugin: vi.fn(),
  installed: false,
  uninstallMCPPlugin: vi.fn(),
}));

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, disabled, loading, onClick }: any) => (
    <button
      data-disabled={disabled ? 'true' : 'false'}
      data-loading={loading ? 'true' : 'false'}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Icon: () => null,
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
  createStaticStyles: () => ({
    button: 'button',
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/MCP/MCPInstallProgress', () => ({
  default: () => null,
}));

vi.mock('@/features/MCPPluginDetail/DetailProvider', () => ({
  useDetailContext: () => detailContextState,
}));

vi.mock('@/layout/AuthProvider/MarketAuth', () => ({
  useMarketAuth: () => marketAuthState,
}));

vi.mock('@/store/tool/slices/plugin/selectors', () => ({
  pluginSelectors: {
    isPluginInstalled: () => (state: typeof toolStoreState) => state.installed,
  },
}));

vi.mock('@/store/tool/store', () => ({
  useToolStore: (selector: any) => selector(toolStoreState),
}));

describe('CommunityMcpActionButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    marketAuthState.isAuthenticated = true;
    marketAuthState.isLoading = false;
    detailContextState.haveCloudEndpoint = false;
    toolStoreState.installed = false;
  });

  it('shows an error when install fails after sign-in', async () => {
    const error = new Error('install failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    toolStoreState.installMCPPlugin.mockRejectedValue(error);

    render(<ActionButton />);

    fireEvent.click(screen.getByRole('button', { name: 'plugins.install' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('store.actions.installFailed');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to install MCP plugin:', error);

    consoleErrorSpy.mockRestore();
  });

  it('shows an error when cloud sign-in fails before install', async () => {
    const error = new Error('sign in failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    detailContextState.haveCloudEndpoint = true;
    marketAuthState.isAuthenticated = false;
    marketAuthState.signIn.mockRejectedValue(error);

    render(<ActionButton />);

    fireEvent.click(screen.getByRole('button', { name: 'plugins.install' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('store.actions.installFailed');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('MCP install sign-in failed:', error);

    consoleErrorSpy.mockRestore();
  });

  it('shows an error and clears loading when uninstall fails', async () => {
    const error = new Error('uninstall failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    toolStoreState.installed = true;
    toolStoreState.uninstallMCPPlugin.mockRejectedValue(error);

    render(<ActionButton />);

    fireEvent.click(screen.getAllByRole('button')[1]);

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('store.actions.uninstallFailed');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to uninstall MCP plugin:', error);
    expect(screen.getAllByRole('button')[1]).toHaveAttribute('data-loading', 'false');

    consoleErrorSpy.mockRestore();
  });
});
