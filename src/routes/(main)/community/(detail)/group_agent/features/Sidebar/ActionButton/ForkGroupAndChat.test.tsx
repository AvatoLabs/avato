/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ForkGroupAndChat from './ForkGroupAndChat';

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
    t: (key: string, options?: any) => options?.defaultValue ?? key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/layout/AuthProvider/MarketAuth', () => ({
  useMarketAuth: () => ({
    isAuthenticated: false,
    signIn: mockSignIn,
  }),
}));

vi.mock('@/services/chatGroup', () => ({
  chatGroupService: {
    createGroupWithMembers: vi.fn(),
    getGroupByForkedFromIdentifier: vi.fn(),
  },
}));

vi.mock('@/services/discover', () => ({
  discoverService: {
    reportAgentEvent: vi.fn(),
  },
}));

vi.mock('@/services/marketApi', () => ({
  marketApiService: {
    forkAgentGroup: vi.fn(),
  },
}));

vi.mock('@/store/agentGroup', () => ({
  useAgentGroupStore: (selector: any) =>
    selector({
      loadGroups: vi.fn(),
    }),
}));

vi.mock('../../DetailProvider', () => ({
  useDetailContext: () => ({
    avatar: 'A',
    backgroundColor: '#fff',
    config: { openingMessage: 'hello' },
    description: 'desc',
    identifier: 'group-1',
    memberAgents: [],
    tags: [],
    title: 'Group',
  }),
}));

describe('ForkGroupAndChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when sign-in fails before forking', async () => {
    const error = new Error('sign in failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSignIn.mockRejectedValue(error);

    render(<ForkGroupAndChat />);

    fireEvent.click(screen.getByRole('button', { name: 'fork.forkAndChat' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('fork.failed');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Fork group sign-in failed:', error);
    expect(mockNavigate).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
