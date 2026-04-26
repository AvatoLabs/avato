/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Header from './Header';

const mockMessageError = vi.hoisted(() => vi.fn());
const mockSignIn = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/icons', () => ({
  MCP: () => null,
}));

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ onClick }: any) => (
    <button aria-label="favorite-action" type="button" onClick={onClick}>
      favorite
    </button>
  ),
  Avatar: ({ children }: any) => <div>{children}</div>,
  Button: ({ children }: any) => <button type="button">{children}</button>,
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Icon: () => null,
  Tag: ({ children }: any) => <div>{children}</div>,
  Text: ({ children }: any) => <div>{children}</div>,
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipGroup: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: mockMessageError,
        success: vi.fn(),
      },
    }),
  },
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    time: 'time',
  }),
  cssVar: {
    colorTextSecondary: '#999',
  },
  useResponsive: () => ({
    mobile: false,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children }: any) => <a>{children}</a>,
}));

vi.mock('swr', () => ({
  default: () => ({
    data: undefined,
    mutate: vi.fn(),
  }),
}));

vi.mock('@/components/PublishedTime', () => ({
  default: () => null,
}));

vi.mock('@/layout/AuthProvider/MarketAuth', () => ({
  useMarketAuth: () => ({
    isAuthenticated: false,
    signIn: mockSignIn,
  }),
}));

vi.mock('@/services/social', () => ({
  socialService: {
    addFavorite: vi.fn(),
    checkFavoriteStatus: vi.fn(),
    removeFavorite: vi.fn(),
  },
}));

vi.mock('@/utils/format', () => ({
  formatIntergerNumber: (value: number) => String(value),
}));

vi.mock('../../../(list)/agent/features/Category/useCategory', () => ({
  useCategory: () => [
    {
      icon: null,
      key: 'productivity',
      label: 'Productivity',
    },
  ],
}));

vi.mock('./AgentForkTag', () => ({
  default: () => null,
}));

vi.mock('./DetailProvider', () => ({
  useDetailContext: () => ({
    author: 'Author',
    avatar: 'A',
    category: 'productivity',
    createdAt: '2024-01-01',
    identifier: 'agent-1',
    title: 'Agent',
    userName: 'author',
  }),
}));

describe('CommunityAgentHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when sign-in fails before favoriting', async () => {
    const error = new Error('sign in failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSignIn.mockRejectedValue(error);

    render(<Header />);

    fireEvent.click(screen.getByRole('button', { name: 'favorite-action' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('assistant.favoriteFailed');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Favorite sign-in failed:', error);

    consoleErrorSpy.mockRestore();
  });
});
