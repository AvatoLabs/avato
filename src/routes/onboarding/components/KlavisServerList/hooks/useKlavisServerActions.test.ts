/**
 * @vitest-environment happy-dom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useKlavisServerActions } from './useKlavisServerActions';

const mockMessageError = vi.hoisted(() => vi.fn());
const toolStoreState = vi.hoisted(() => ({
  createKlavisServer: vi.fn(),
  refreshKlavisServerTools: vi.fn(),
}));
const userStoreState = vi.hoisted(() => ({
  toggleInboxAgentDefaultPlugin: vi.fn(),
  userId: 'user-1',
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
    t: (key: string) => key,
  }),
}));

vi.mock('@/store/tool/store', () => ({
  useToolStore: (selector: any) => selector(toolStoreState),
}));

vi.mock('@/store/user', () => ({
  useUserStore: (selector: any) => selector(userStoreState),
}));

vi.mock('@/store/user/selectors', () => ({
  userProfileSelectors: {
    userId: (state: any) => state.userId,
  },
}));

describe('useKlavisServerActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when connecting a server fails', async () => {
    toolStoreState.createKlavisServer.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useKlavisServerActions({
        identifier: 'gmail',
        serverName: 'Gmail',
      }),
    );

    await act(async () => {
      await result.current.handleConnect();
    });

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('tools.klavis.connectFailed');
    });
  });
});
