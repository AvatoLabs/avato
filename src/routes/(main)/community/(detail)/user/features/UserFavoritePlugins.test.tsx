/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UserFavoritePlugins from './UserFavoritePlugins';

const mockMessageSuccess = vi.hoisted(() => vi.fn());
const mockMessageError = vi.hoisted(() => vi.fn());
const mockMutate = vi.hoisted(() => vi.fn());
const discoverStoreState = vi.hoisted(() => ({
  removeFavorite: vi.fn(),
  useFavoritePlugins: vi.fn(),
}));

vi.mock('@lobehub/ui', () => ({
  Avatar: () => null,
  Block: ({ children, onClick }: any) => <div onClick={onClick}>{children}</div>,
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Grid: ({ children }: any) => <div>{children}</div>,
  Icon: () => null,
  Tag: ({ children }: any) => <span>{children}</span>,
  Text: ({ children }: any) => <span>{children}</span>,
  Tooltip: ({ children }: any) => <div>{children}</div>,
  stopPropagation: vi.fn(),
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
  createStaticStyles: () => ({
    desc: 'desc',
    favoriteButton: 'favoriteButton',
    footer: 'footer',
    secondaryDesc: 'secondaryDesc',
    title: 'title',
    wrapper: 'wrapper',
  }),
  cx: (...classNames: string[]) => classNames.filter(Boolean).join(' '),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children }: any) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
}));

vi.mock('@/components/PublishedTime', () => ({
  default: () => null,
}));

vi.mock('@/store/discover', () => ({
  useDiscoverStore: (selector: any) => selector(discoverStoreState),
}));

vi.mock('./DetailProvider', () => ({
  useUserDetailContext: () => ({
    isOwner: true,
    user: { id: 1 },
  }),
}));

describe('UserFavoritePlugins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    discoverStoreState.useFavoritePlugins.mockReturnValue({
      data: {
        data: [
          {
            favoritedAt: '2024-01-01',
            plugin: {
              avatar: 'P',
              category: 'productivity',
              description: 'desc',
              id: 24,
              identifier: 'plugin-1',
              name: 'Plugin One',
              tags: [],
            },
          },
        ],
      },
      mutate: mockMutate,
    });
  });

  it('removes a nested favorite plugin item returned by SDK payloads', async () => {
    const { container } = render(<UserFavoritePlugins />);

    fireEvent.click(container.querySelector('.favorite-button')!);

    await waitFor(() => {
      expect(discoverStoreState.removeFavorite).toHaveBeenCalledWith('plugin', 24);
    });

    expect(mockMutate).toHaveBeenCalled();
    expect(mockMessageSuccess).toHaveBeenCalledWith('user.unfavoriteSuccess');
  });
});
