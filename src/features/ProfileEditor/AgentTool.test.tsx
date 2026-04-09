/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AgentTool from './AgentTool';

const mockMessageError = vi.hoisted(() => vi.fn());
const mockUpdateAgentConfigById = vi.hoisted(() => vi.fn());
const agentStoreState = vi.hoisted(() => ({
  activeAgentId: 'agent-1',
  agentConfigById: {
    'agent-1': {
      plugins: [] as string[],
    },
  } as Record<string, { plugins: string[] }>,
  chatConfigById: {
    'agent-1': {
      searchMode: 'off',
    },
  } as Record<string, { searchMode: string }>,
  updateAgentChatConfigById: vi.fn(),
  updateAgentConfigById: mockUpdateAgentConfigById,
}));
const toolStoreState = vi.hoisted(() => ({
  agentSkillsMarket: [] as any[],
  agentSkillsUser: [] as any[],
  builtinMetaList: [
    {
      identifier: 'builtin-1',
      meta: {
        avatar: '🧰',
        title: 'Builtin Tool',
      },
    },
  ] as any[],
  installedBuiltinSkills: [] as any[],
  installedPluginMetaList: [] as any[],
  klavisServers: [] as any[],
  lobehubSkillServers: [] as any[],
  useFetchAgentSkills: vi.fn(),
  useFetchLobehubSkillConnections: vi.fn(),
  useFetchUninstalledBuiltinTools: vi.fn(),
  useFetchUserKlavisServers: vi.fn(),
}));
const serverConfigState = vi.hoisted(() => ({
  enableKlavis: false,
  enableLobehubSkill: false,
}));

const useAgentStoreMock = vi.hoisted(() =>
  Object.assign((selector: any) => selector(agentStoreState), {
    getState: () => agentStoreState,
  }),
);

const useToolStoreMock = vi.hoisted(() =>
  Object.assign((selector: any) => selector(toolStoreState), {
    getState: () => toolStoreState,
  }),
);

vi.mock('@lobechat/const', () => ({
  KLAVIS_SERVER_TYPES: [],
  LOBEHUB_SKILL_PROVIDERS: [],
}));

vi.mock('@lobehub/ui', () => ({
  Avatar: () => null,
  Button: ({ children, loading }: any) => (
    <button data-loading={loading ? 'true' : 'false'} type="button">
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
  cssVar: {
    colorTextSecondary: '#999',
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@/components/Plugins/PluginAvatar', () => ({
  default: () => null,
}));

vi.mock('@/features/ChatInput/ActionBar/components/ActionDropdown', () => ({
  default: ({ children, popupRender }: any) => (
    <div>
      {children}
      {popupRender?.()}
    </div>
  ),
}));

vi.mock('@/features/ChatInput/ActionBar/Tools/KlavisServerItem', () => ({
  default: () => null,
}));

vi.mock('@/features/ChatInput/ActionBar/Tools/KlavisSkillIcon', () => ({
  SKILL_ICON_SIZE: 20,
  default: () => null,
}));

vi.mock('@/features/ChatInput/ActionBar/Tools/LobehubSkillIcon', () => ({
  default: () => null,
}));

vi.mock('@/features/ChatInput/ActionBar/Tools/LobehubSkillServerItem', () => ({
  default: () => null,
}));

vi.mock('@/features/ChatInput/ActionBar/Tools/ToolItem', () => ({
  default: ({ id, label, onUpdate }: any) => (
    <button aria-label={`tool-${id}`} type="button" onClick={onUpdate}>
      {label}
    </button>
  ),
}));

vi.mock('@/features/SkillStore', () => ({
  createSkillStoreModal: vi.fn(),
}));

vi.mock('@/hooks/useCheckPluginsIsInstalled', () => ({
  useCheckPluginsIsInstalled: vi.fn(),
}));

vi.mock('@/hooks/useFetchInstalledPlugins', () => ({
  useFetchInstalledPlugins: vi.fn(),
}));

vi.mock('@/store/agent/selectors', () => ({
  agentSelectors: {
    getAgentConfigById: (agentId: string) => (state: typeof agentStoreState) =>
      state.agentConfigById[agentId],
  },
  chatConfigByIdSelectors: {
    isEnableSearchById: (agentId: string) => (state: typeof agentStoreState) =>
      state.chatConfigById[agentId]?.searchMode !== 'off',
  },
}));

vi.mock('@/store/agent/store', () => ({
  useAgentStore: useAgentStoreMock,
}));

vi.mock('@/store/serverConfig', () => ({
  serverConfigSelectors: {
    enableKlavis: (state: typeof serverConfigState) => state.enableKlavis,
    enableLobehubSkill: (state: typeof serverConfigState) => state.enableLobehubSkill,
  },
  useServerConfigStore: (selector: any) => selector(serverConfigState),
}));

vi.mock('@/store/tool/selectors', () => ({
  agentSkillsSelectors: {
    getMarketAgentSkills: (state: typeof toolStoreState) => state.agentSkillsMarket,
    getUserAgentSkills: (state: typeof toolStoreState) => state.agentSkillsUser,
  },
  builtinToolSelectors: {
    installedAllMetaList: (state: typeof toolStoreState) => state.builtinMetaList,
    installedBuiltinSkills: (state: typeof toolStoreState) => state.installedBuiltinSkills,
    metaList: (state: typeof toolStoreState) => state.builtinMetaList,
  },
  klavisStoreSelectors: {
    getServers: (state: typeof toolStoreState) => state.klavisServers,
  },
  lobehubSkillStoreSelectors: {
    getServers: (state: typeof toolStoreState) => state.lobehubSkillServers,
  },
  pluginSelectors: {
    installedPluginMetaList: (state: typeof toolStoreState) => state.installedPluginMetaList,
  },
}));

vi.mock('@/store/tool/store', () => ({
  useToolStore: useToolStoreMock,
}));

vi.mock('./PluginTag', () => ({
  default: () => null,
}));

vi.mock('./PopoverContent', () => ({
  default: ({ allTabItems }: any) => {
    const flattenItems = (items: any[]): any[] =>
      items.flatMap((item) => {
        if (!item) return [];
        if (item.children) return flattenItems(item.children);
        return [item];
      });

    return (
      <div>
        {flattenItems(allTabItems).map((item) => (
          <div key={String(item.key)}>{item.label}</div>
        ))}
      </div>
    );
  },
}));

describe('AgentTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agentStoreState.agentConfigById = {
      'agent-1': {
        plugins: [],
      },
    };
  });

  it('shows an error and clears loading when updating tools fails', async () => {
    const error = new Error('update failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUpdateAgentConfigById.mockRejectedValue(error);

    render(<AgentTool />);

    fireEvent.click(screen.getByRole('button', { name: 'tool-builtin-1' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('settingAgent.tools.updateError');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('[AgentTool] Failed to update tools:', error);
    expect(screen.getByRole('button', { name: 'Add' })).toHaveAttribute('data-loading', 'false');

    consoleErrorSpy.mockRestore();
  });
});
