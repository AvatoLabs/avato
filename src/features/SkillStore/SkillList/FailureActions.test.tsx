/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AgentSkillItem from './AgentSkillItem';
import BuiltinItem from './Builtin/Item';
import CommunityItem from './Community/Item';
import CustomItem from './Custom/Item';

const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockMessageError = vi.hoisted(() => vi.fn());
const toolStoreState = vi.hoisted(() => ({
  builtinInstalled: false,
  cancelInstallMCPPlugin: vi.fn(),
  customPlugin: null as any,
  deleteAgentSkill: vi.fn(),
  installBuiltinTool: vi.fn(),
  installMCPPlugin: vi.fn(),
  installProgress: undefined as any,
  installed: false,
  installing: false,
  plugin: undefined as any,
  pluginManifest: undefined as any,
  uninstallBuiltinTool: vi.fn(),
  uninstallPlugin: vi.fn(),
  updateCustomPlugin: vi.fn(),
}));
const agentStoreState = vi.hoisted(() => ({
  currentAgentPlugins: [] as string[],
  togglePlugin: vi.fn(),
}));
const marketAuthState = vi.hoisted(() => ({
  isAuthenticated: true,
  signIn: vi.fn(),
}));

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ onClick, title }: any) => (
    <button aria-label={title || 'action'} type="button" onClick={onClick} />
  ),
  Avatar: () => null,
  Block: ({ children, onClick }: any) => <div onClick={onClick}>{children}</div>,
  DropdownMenu: ({ children, items }: any) => (
    <div>
      {children}
      {items?.map((item: any) =>
        item?.type === 'divider' ? null : (
          <button key={item.key} type="button" onClick={item.onClick}>
            {item.label}
          </button>
        ),
      )}
    </div>
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Icon: () => null,
  Modal: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  Tag: ({ children }: any) => <span>{children}</span>,
  stopPropagation: vi.fn(),
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: mockMessageError,
      },
      modal: {
        confirm: mockModalConfirm,
      },
    }),
  },
  Button: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('antd-style', () => ({
  createStaticStyles: (factory: any) =>
    factory({
      css: () => '',
      cssVar: {
        colorPrimary: '',
        colorText: '',
      },
      cx: (...classNames: string[]) => classNames.filter(Boolean).join(' '),
      responsive: {
        sm: '',
      },
    }),
  cssVar: {
    colorPrimary: '',
    colorText: '',
  },
  responsive: {
    sm: '',
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/Plugins/MCPTag', () => ({
  default: () => null,
}));

vi.mock('@/components/Plugins/PluginAvatar', () => ({
  default: () => null,
}));

vi.mock('@/features/MCP/MCPDetail', () => ({
  default: () => null,
}));

vi.mock('@/features/MCP/MCPDetail/Loading', () => ({
  default: () => null,
}));

vi.mock('@/features/MCP/MCPInstallProgress', () => ({
  default: () => null,
}));

vi.mock('@/features/PluginDetailModal', () => ({
  default: () => null,
}));

vi.mock('@/features/PluginDevModal', () => ({
  default: () => null,
}));

vi.mock('@/layout/AuthProvider/MarketAuth', () => ({
  useMarketAuth: () => marketAuthState,
}));

vi.mock('@/store/agent/selectors', () => ({
  agentSelectors: {
    currentAgentPlugins: (state: typeof agentStoreState) => state.currentAgentPlugins,
  },
}));

vi.mock('@/store/agent/store', () => ({
  useAgentStore: (selector: any) => selector(agentStoreState),
}));

vi.mock('@/store/tool/selectors', () => ({
  builtinToolSelectors: {
    isBuiltinToolInstalled: () => (state: typeof toolStoreState) => state.builtinInstalled,
  },
  mcpStoreSelectors: {
    getMCPInstallProgress: () => (state: typeof toolStoreState) => state.installProgress,
    getPluginById: () => (state: typeof toolStoreState) => state.plugin,
    isMCPInstalling: () => (state: typeof toolStoreState) => state.installing,
  },
  pluginSelectors: {
    getCustomPluginById: () => (state: typeof toolStoreState) => state.customPlugin,
    getToolManifestById: () => (state: typeof toolStoreState) => state.pluginManifest,
    isPluginInstalled: () => (state: typeof toolStoreState) => state.installed,
  },
}));

vi.mock('@/store/tool/store', () => ({
  useToolStore: (selector: any) => selector(toolStoreState),
}));

describe('Skill store item actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toolStoreState.builtinInstalled = false;
    toolStoreState.installed = false;
    toolStoreState.installing = false;
    toolStoreState.plugin = undefined;
    toolStoreState.customPlugin = null;
    toolStoreState.installProgress = undefined;
    agentStoreState.currentAgentPlugins = [];
    marketAuthState.isAuthenticated = true;
  });

  it('shows an error when installing a builtin tool fails', async () => {
    const error = new Error('builtin install failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    toolStoreState.installBuiltinTool.mockRejectedValue(error);

    render(<BuiltinItem identifier="builtin-tool" />);

    fireEvent.click(screen.getByRole('button', { name: 'tools.builtins.install' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('store.actions.installFailed');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to install builtin tool:', error);

    consoleErrorSpy.mockRestore();
  });

  it('shows an error when uninstalling a custom plugin fails', async () => {
    const error = new Error('custom uninstall failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    agentStoreState.currentAgentPlugins = ['custom-plugin'];
    toolStoreState.uninstallPlugin.mockRejectedValue(error);

    render(<CustomItem identifier="custom-plugin" />);

    fireEvent.click(screen.getByRole('button', { name: 'store.actions.uninstall' }));

    const confirmConfig = mockModalConfirm.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockMessageError).toHaveBeenCalledWith('store.actions.uninstallFailed');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to uninstall custom plugin:', error);

    consoleErrorSpy.mockRestore();
  });

  it('shows an error when installing a community plugin fails', async () => {
    const error = new Error('community install failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    toolStoreState.installMCPPlugin.mockRejectedValue(error);

    render(
      <CommunityItem
        {...({ description: 'desc', icon: 'icon.png', identifier: 'community-plugin', name: 'Hub' } as any)}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'store.actions.install' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('store.actions.installFailed');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to install community plugin:', error);

    consoleErrorSpy.mockRestore();
  });

  it('shows an error when uninstalling a community plugin fails', async () => {
    const error = new Error('community uninstall failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    toolStoreState.installed = true;
    agentStoreState.currentAgentPlugins = ['community-plugin'];
    toolStoreState.uninstallPlugin.mockRejectedValue(error);

    render(
      <CommunityItem
        {...({ description: 'desc', icon: 'icon.png', identifier: 'community-plugin', name: 'Hub' } as any)}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'store.actions.uninstall' }));

    const confirmConfig = mockModalConfirm.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockMessageError).toHaveBeenCalledWith('store.actions.uninstallFailed');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to uninstall community plugin:', error);

    consoleErrorSpy.mockRestore();
  });

  it('shows an error when deleting an agent skill fails', async () => {
    const error = new Error('agent skill delete failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    toolStoreState.deleteAgentSkill.mockRejectedValue(error);

    render(
      <AgentSkillItem
        skill={{ id: 'skill-1', name: 'Agent Skill', source: 'system', zipSha256: null } as any}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'store.actions.uninstall' }));

    const confirmConfig = mockModalConfirm.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockMessageError).toHaveBeenCalledWith('store.actions.uninstallFailed');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to delete agent skill:', error);

    consoleErrorSpy.mockRestore();
  });
});
