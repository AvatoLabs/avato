/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ForkAndChat from './ForkAndChat';

const mockMessageError = vi.hoisted(() => vi.fn());
const mockSignIn = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: mockMessageError,
        info: vi.fn(),
        success: vi.fn(),
      },
    }),
  },
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    buttonGroup: 'buttonGroup',
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/const/url', () => ({
  SESSION_CHAT_URL: vi.fn(),
}));

vi.mock('@/layout/AuthProvider/MarketAuth', () => ({
  useMarketAuth: () => ({
    isAuthenticated: false,
    signIn: mockSignIn,
  }),
}));

vi.mock('@/services/agent', () => ({
  agentService: {
    getAgentByForkedFromIdentifier: vi.fn(),
  },
}));

vi.mock('@/services/discover', () => ({
  discoverService: {
    reportAgentEvent: vi.fn(),
  },
}));

vi.mock('@/services/marketApi', () => ({
  marketApiService: {
    forkAgent: vi.fn(),
  },
}));

vi.mock('@/store/agent/store', () => ({
  useAgentStore: (selector: any) =>
    selector({
      createAgent: vi.fn(),
    }),
}));

vi.mock('@/store/home/store', () => ({
  useHomeStore: (selector: any) =>
    selector({
      refreshAgentList: vi.fn(),
    }),
}));

vi.mock('../../DetailProvider', () => ({
  useDetailContext: () => ({
    avatar: 'A',
    backgroundColor: '#fff',
    config: { model: 'gpt-4o', provider: 'openai' },
    description: 'desc',
    editorData: '{}',
    identifier: 'agent-1',
    tags: [],
    title: 'Agent',
  }),
}));

describe('ForkAndChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when sign-in fails before forking', async () => {
    const error = new Error('sign in failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSignIn.mockRejectedValue(error);

    render(<ForkAndChat />);

    fireEvent.click(screen.getByRole('button', { name: 'fork.forkAndChat' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('fork.failed');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Fork sign-in failed:', error);
    expect(mockNavigate).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
