/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Actions from './Actions';

const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockMessage = vi.hoisted(() => ({
  error: vi.fn(),
}));
const toolStoreState = vi.hoisted(() => ({
  installMCPPlugin: vi.fn(),
  installPlugin: vi.fn(),
  installing: false,
  installed: false,
  plugin: undefined as any,
  uninstallPlugin: vi.fn(),
}));
const agentStoreState = vi.hoisted(() => ({
  currentAgentPlugins: [] as string[],
  togglePlugin: vi.fn(),
}));

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenu: ({ children, items }: any) => (
    <div>
      {children}
      {items?.map((item: any) => (
        <button key={item.key} type="button" onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </div>
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Icon: () => null,
  stopPropagation: vi.fn(),
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: mockMessage,
      modal: {
        confirm: mockModalConfirm,
      },
    }),
  },
  Space: {
    Compact: ({ children }: any) => <div>{children}</div>,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/MCP/MCPSettings/McpSettingsModal', () => ({
  default: () => null,
}));

vi.mock('@/features/PluginDetailModal', () => ({
  default: () => null,
}));

vi.mock('@/store/agent/selectors', () => ({
  agentSelectors: {
    currentAgentPlugins: () => agentStoreState.currentAgentPlugins,
  },
}));

vi.mock('@/store/agent/store', () => ({
  useAgentStore: (selector: any) =>
    selector({
      togglePlugin: agentStoreState.togglePlugin,
    }),
}));

vi.mock('@/store/serverConfig', () => ({
  useServerConfigStore: (selector: any) => selector({ isMobile: false }),
}));

vi.mock('@/store/tool/helpers', () => ({
  pluginHelpers: {
    isSettingSchemaNonEmpty: () => false,
  },
}));

vi.mock('@/store/tool/selectors', () => ({
  pluginSelectors: {
    getToolManifestById: () => () => toolStoreState.plugin,
    isPluginInstalled: () => () => toolStoreState.installed,
  },
  pluginStoreSelectors: {
    isPluginInstallLoading: () => () => toolStoreState.installing,
  },
}));

vi.mock('@/store/tool/store', () => ({
  useToolStore: (selector: any) =>
    selector({
      installMCPPlugin: toolStoreState.installMCPPlugin,
      installPlugin: toolStoreState.installPlugin,
      uninstallPlugin: toolStoreState.uninstallPlugin,
    }),
}));

vi.mock('./EditCustomPlugin', () => ({
  default: ({ children }: any) => <>{children}</>,
}));

describe('Skill settings actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toolStoreState.installing = false;
    toolStoreState.installed = false;
    toolStoreState.plugin = undefined;
    agentStoreState.currentAgentPlugins = [];
  });

  it('shows an error when installing a plugin fails', async () => {
    const error = new Error('install failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    toolStoreState.installPlugin.mockRejectedValue(error);

    render(<Actions identifier="plugin-1" type="plugin" />);

    fireEvent.click(screen.getByRole('button', { name: 'store.actions.install' }));

    await waitFor(() => {
      expect(mockMessage.error).toHaveBeenCalledWith('store.actions.installFailed');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to install plugin:', error);

    consoleErrorSpy.mockRestore();
  });

  it('shows an error when uninstalling a plugin fails', async () => {
    const error = new Error('uninstall failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    toolStoreState.installed = true;
    toolStoreState.uninstallPlugin.mockRejectedValue(error);

    render(<Actions identifier="plugin-1" type="plugin" />);

    fireEvent.click(screen.getByRole('button', { name: 'store.actions.uninstall' }));

    const confirmConfig = mockModalConfirm.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockMessage.error).toHaveBeenCalledWith('store.actions.uninstallFailed');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to uninstall plugin:', error);

    consoleErrorSpy.mockRestore();
  });
});
