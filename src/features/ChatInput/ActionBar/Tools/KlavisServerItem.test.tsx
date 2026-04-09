/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KlavisServerStatus } from '@/store/tool/slices/klavisStore';

import KlavisServerItem from './KlavisServerItem';

const mockMessageError = vi.hoisted(() => vi.fn());
const toolStoreState = vi.hoisted(() => ({
  createKlavisServer: vi.fn(),
  refreshKlavisServerTools: vi.fn(),
}));
const agentStoreState = vi.hoisted(() => ({
  activeAgentId: 'agent-1',
  agentConfigById: {
    'agent-1': { plugins: ['gmail'] },
  } as Record<string, { plugins: string[] }>,
  updateAgentConfigById: vi.fn(),
}));

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
  useAgentStore: (selector: any) => selector(agentStoreState),
}));

vi.mock('@/store/tool/store', () => ({
  useToolStore: (selector: any) => selector(toolStoreState),
}));

vi.mock('@/store/user', () => ({
  useUserStore: (selector: any) => selector({ userId: 'user-1' }),
}));

vi.mock('@/store/user/selectors', () => ({
  userProfileSelectors: {
    userId: (state: any) => state.userId,
  },
}));

describe('KlavisServerItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agentStoreState.agentConfigById = {
      'agent-1': { plugins: ['gmail'] },
    };
  });

  it('shows an error when connecting a server fails', async () => {
    toolStoreState.createKlavisServer.mockResolvedValue(undefined);

    render(<KlavisServerItem identifier="gmail" label="Gmail" serverName="Gmail" />);

    fireEvent.click(screen.getByText('Connect'));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('tools.klavis.connectFailed');
    });
  });

  it('shows an error and clears toggling state when plugin toggle fails', async () => {
    const error = new Error('toggle failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    agentStoreState.updateAgentConfigById.mockRejectedValue(error);

    render(
      <KlavisServerItem
        identifier="gmail"
        label="Gmail"
        server={{
          createdAt: Date.now(),
          identifier: 'gmail',
          instanceId: 'inst-1',
          isAuthenticated: true,
          serverName: 'Gmail',
          serverUrl: 'https://klavis.example/gmail',
          status: KlavisServerStatus.CONNECTED,
        }}
        serverName="Gmail"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'checkbox' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('tools.klavis.togglePluginFailed');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('[Klavis] Failed to toggle plugin:', error);
    expect(screen.getByRole('button', { name: 'checkbox' })).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});
