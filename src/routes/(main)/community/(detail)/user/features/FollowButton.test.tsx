/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FollowButton from './FollowButton';

const mockFollow = vi.hoisted(() => vi.fn());
const mockUnfollow = vi.hoisted(() => vi.fn());
const mockMutate = vi.hoisted(() => vi.fn());
const mockMessageSuccess = vi.hoisted(() => vi.fn());
const mockMessageError = vi.hoisted(() => vi.fn());
const followState = vi.hoisted(() => ({
  isAuthenticated: true,
  isFollowing: false,
}));

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, loading, onClick }: any) => (
    <button disabled={loading} type="button" onClick={onClick}>
      {children}
    </button>
  ),
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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/layout/AuthProvider/MarketAuth', () => ({
  useMarketAuth: () => ({
    isAuthenticated: followState.isAuthenticated,
    signIn: vi.fn(),
  }),
}));

vi.mock('@/store/discover', () => ({
  useDiscoverStore: (selector: any) =>
    selector({
      follow: mockFollow,
      unfollow: mockUnfollow,
      useFollowStatus: () => ({
        data: { isFollowing: followState.isFollowing },
        mutate: mockMutate,
      }),
    }),
}));

describe('FollowButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    followState.isAuthenticated = true;
    followState.isFollowing = false;
  });

  it('shows an error when follow fails', async () => {
    const error = new Error('follow failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFollow.mockRejectedValue(error);

    render(<FollowButton userId={1} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'user.follow' }));
    });

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('user.followFailed');
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Follow action failed:', error);

    consoleErrorSpy.mockRestore();
  });

  it('shows a success message when unfollow succeeds', async () => {
    followState.isFollowing = true;
    mockUnfollow.mockResolvedValue(undefined);

    render(<FollowButton userId={1} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'user.unfollow' }));
    });

    await waitFor(() => {
      expect(mockUnfollow).toHaveBeenCalledWith(1);
    });
    expect(mockMutate).toHaveBeenCalled();
    expect(mockMessageSuccess).toHaveBeenCalledWith('user.unfollowSuccess');
  });
});
