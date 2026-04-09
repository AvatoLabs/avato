/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobehubSkillStatus } from '@/store/tool/slices/lobehubSkillStore/types';

import LobehubSkillServerItem from './LobehubSkillServerItem';

const mockMessageError = vi.hoisted(() => vi.fn());
const toolStoreState = vi.hoisted(() => ({
  checkLobehubSkillStatus: vi.fn(),
  getLobehubSkillAuthorizeUrl: vi.fn(),
  lobehubServerMap: {} as Record<string, any>,
  lobehubSkillServers: [] as any[],
}));
const agentStoreState = vi.hoisted(() => ({
  activeAgentId: 'agent-1',
  agentConfigById: {
    'agent-1': { plugins: ['linear'] },
  } as Record<string, { plugins: string[] }>,
  updateAgentConfigById: vi.fn(),
}));

const useToolStoreMock = vi.hoisted(() =>
  Object.assign((selector: any) => selector(toolStoreState), {
    getState: () => toolStoreState,
  }),
);

const useAgentStoreMock = vi.hoisted(() =>
  Object.assign((selector: any) => selector(agentStoreState), {
    getState: () => agentStoreState,
  }),
);

vi.mock('@lobehub/ui', () => ({
  Checkbox: ({ checked, onClick }: any) => (
    <button aria-label="checkbox" data-checked={checked} type="button" onClick={onClick}>
      checkbox
    </button>
  ),
  Flexbox: ({ children, onClick }: any) => <div onClick={onClick}>{children}</div>,
  Icon: () => null,
  stopPropagation: vi.fn(),
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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@/store/agent/selectors', () => ({
  agentSelectors: {
    getAgentConfigById: (agentId: string) => (state: any) => state.agentConfigById[agentId],
  },
}));

vi.mock('@/store/agent/store', () => ({
  useAgentStore: useAgentStoreMock,
}));

vi.mock('@/store/tool/selectors', () => ({
  lobehubSkillStoreSelectors: {
    getServerByIdentifier: (identifier: string) =>
      (state: any) => state.lobehubServerMap[identifier],
  },
}));

vi.mock('@/store/tool/store', () => ({
  useToolStore: useToolStoreMock,
}));

describe('LobehubSkillServerItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toolStoreState.lobehubServerMap = {};
    toolStoreState.lobehubSkillServers = [];
    agentStoreState.agentConfigById = {
      'agent-1': { plugins: ['linear'] },
    };
  });

  it('shows an error when connecting a skill fails', async () => {
    toolStoreState.getLobehubSkillAuthorizeUrl.mockRejectedValue(new Error('connect failed'));

    render(<LobehubSkillServerItem label="Linear" provider="linear" />);

    fireEvent.click(screen.getByText('Connect'));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('tools.avatohubSkill.connectError');
    });
  });

  it('shows an error and clears toggling state when plugin toggle fails', async () => {
    const error = new Error('toggle failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    toolStoreState.lobehubServerMap.linear = {
      identifier: 'linear',
      isConnected: true,
      status: LobehubSkillStatus.CONNECTED,
    };
    agentStoreState.updateAgentConfigById.mockRejectedValue(error);

    render(<LobehubSkillServerItem label="Linear" provider="linear" />);

    fireEvent.click(screen.getByRole('button', { name: 'checkbox' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('tools.avatohubSkill.togglePluginFailed');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('[LobehubSkill] Failed to toggle plugin:', error);
    expect(screen.getByRole('button', { name: 'checkbox' })).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  it('shows an error when auto-enabling a plugin after OAuth fails', async () => {
    const error = new Error('auto enable failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    toolStoreState.lobehubServerMap.linear = {
      identifier: 'linear',
      isConnected: false,
      status: LobehubSkillStatus.CONNECTING,
    };
    toolStoreState.lobehubSkillServers = [
      {
        identifier: 'linear',
        status: LobehubSkillStatus.CONNECTED,
      },
    ];
    toolStoreState.checkLobehubSkillStatus.mockResolvedValue(undefined);
    agentStoreState.agentConfigById = {
      'agent-1': { plugins: [] },
    };
    agentStoreState.updateAgentConfigById.mockRejectedValue(error);

    render(<LobehubSkillServerItem label="Linear" provider="linear" />);

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            provider: 'linear',
            type: 'LOBEHUB_SKILL_AUTH_SUCCESS',
          },
          origin: window.location.origin,
        }),
      );
    });

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('tools.avatohubSkill.togglePluginFailed');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[LobehubSkill] Failed to auto-enable plugin:',
      error,
    );

    consoleErrorSpy.mockRestore();
  });
});
