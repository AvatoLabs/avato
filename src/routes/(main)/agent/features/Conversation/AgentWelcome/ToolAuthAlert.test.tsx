/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ToolAuthAlert from './ToolAuthAlert';

const mockMessageError = vi.hoisted(() => vi.fn());
const mockSignIn = vi.hoisted(() => vi.fn());
const toolStoreState = vi.hoisted(() => ({
  createKlavisServer: vi.fn(),
  klavisServers: [] as any[],
  refreshKlavisServerTools: vi.fn(),
}));
const agentStoreState = vi.hoisted(() => ({
  plugins: [] as string[],
}));
const marketAuthState = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoading: false,
  signIn: mockSignIn,
}));

vi.mock('@lobechat/const', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@lobechat/const')>();

  return {
    ...actual,
    KLAVIS_SERVER_TYPES: [
      {
        author: 'Klavis',
        description: 'desc',
        icon: 'gmail.png',
        identifier: 'gmail',
        label: 'Gmail',
        readme: 'readme',
        serverName: 'Gmail',
      },
    ],
  };
});

vi.mock('@lobehub/ui', () => ({
  Alert: ({ description, title }: any) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
    </div>
  ),
  Avatar: () => null,
  Button: ({ children, disabled, onClick }: any) => (
    <button disabled={disabled} type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Flexbox: ({ children, onClick }: any) => <div onClick={onClick}>{children}</div>,
  Icon: () => null,
  Text: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: mockMessageError,
      },
    }),
  },
  Divider: () => null,
}));

vi.mock('antd-style', () => ({
  cssVar: {
    colorText: '#000',
  },
}));

vi.mock('fast-deep-equal', () => ({
  default: () => true,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/layout/AuthProvider/MarketAuth', () => ({
  useMarketAuth: () => marketAuthState,
}));

vi.mock('@/store/agent/selectors', () => ({
  agentSelectors: {
    currentAgentPlugins: (state: any) => state.plugins,
  },
}));

vi.mock('@/store/agent/store', () => ({
  useAgentStore: (selector: any) => selector(agentStoreState),
}));

vi.mock('@/store/tool/slices/klavisStore', () => ({
  KlavisServerStatus: {
    CONNECTED: 'connected',
    PENDING_AUTH: 'pending',
  },
  klavisStoreSelectors: {
    getServers: (state: any) => state.klavisServers,
  },
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

describe('ToolAuthAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agentStoreState.plugins = [];
    toolStoreState.klavisServers = [];
    marketAuthState.isAuthenticated = false;
    marketAuthState.isLoading = false;
  });

  it('shows an error when Klavis authorization fails', async () => {
    agentStoreState.plugins = ['gmail'];
    toolStoreState.createKlavisServer.mockResolvedValue(undefined);

    render(<ToolAuthAlert />);

    fireEvent.click(screen.getByText('Gmail'));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('toolAuth.authorizeFailed');
    });
  });

  it('shows an error when Market sign-in fails', async () => {
    agentStoreState.plugins = ['lobe-cloud-sandbox'];
    mockSignIn.mockRejectedValue(new Error('sign in failed'));

    render(<ToolAuthAlert />);

    fireEvent.click(screen.getByText('Cloud Sandbox'));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('toolAuth.signInFailed');
    });
  });
});
