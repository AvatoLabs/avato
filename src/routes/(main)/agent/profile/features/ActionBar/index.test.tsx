/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ActionBar from './index';

const mockDuplicateAgent = vi.hoisted(() => vi.fn());
const mockRemoveAgent = vi.hoisted(() => vi.fn());
const mockMessageSuccess = vi.hoisted(() => vi.fn());
const mockMessageError = vi.hoisted(() => vi.fn());
const mockPush = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Dropdown: ({ children, menu }: any) => (
    <div>
      {children}
      {menu?.items?.filter(Boolean).map((item: any) =>
        item.type === 'divider' ? null : (
          <button key={item.key} type="button" onClick={item.onClick}>
            {item.label}
          </button>
        ),
      )}
    </div>
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Icon: () => null,
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: mockMessageError,
        success: mockMessageSuccess,
      },
    }),
  },
}));

vi.mock('antd-style', () => ({
  useTheme: () => ({
    borderRadiusLG: 12,
    colorBgContainer: '#fff',
    colorBorderSecondary: '#ddd',
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/hooks/useQueryRoute', () => ({
  useQueryRoute: () => ({
    push: mockPush,
  }),
}));

vi.mock('@/store/agent/selectors', () => ({
  agentSelectors: {
    currentAgentTitle: () => 'Agent Title',
  },
}));

vi.mock('@/store/agent/store', () => ({
  useAgentStore: (selector: any) =>
    selector({
      activeAgentId: 'agent-1',
      agentMap: { 'agent-1': { id: 'agent-1', title: 'Agent Title' } },
    }),
}));

vi.mock('@/store/chat', () => ({
  useChatStore: (selector: any) =>
    selector({
      switchTopic: vi.fn(),
    }),
}));

vi.mock('@/store/home/store', () => ({
  useHomeStore: (selector: any) =>
    selector({
      duplicateAgent: mockDuplicateAgent,
      removeAgent: mockRemoveAgent,
    }),
}));

vi.mock('@/store/serverConfig', () => ({
  useServerConfigStore: () => true,
  serverConfigSelectors: {
    enableBusinessFeatures: 'enableBusinessFeatures',
  },
}));

describe('ActionBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when duplicating an agent fails', async () => {
    const error = new Error('duplicate failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockDuplicateAgent.mockRejectedValue(error);

    render(<ActionBar />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'duplicate' }));
    });

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('myAgents.errors.duplicateFailed');
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to duplicate agent:', error);

    consoleErrorSpy.mockRestore();
  });

  it('shows success and navigates home when deleting an agent succeeds', async () => {
    mockRemoveAgent.mockResolvedValue(undefined);

    render(<ActionBar />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'delete' }));
    });

    await waitFor(() => {
      expect(mockRemoveAgent).toHaveBeenCalledWith('agent-1');
    });
    expect(mockMessageSuccess).toHaveBeenCalledWith('myAgents.actions.deleteSuccess');
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
