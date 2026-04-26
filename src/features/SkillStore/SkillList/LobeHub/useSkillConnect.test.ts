/**
 * @vitest-environment happy-dom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KlavisServerStatus } from '@/store/tool/slices/klavisStore';
import { LobehubSkillStatus } from '@/store/tool/slices/lobehubSkillStore/types';

import { useSkillConnect } from './useSkillConnect';

const mockGetProvider = vi.hoisted(() => vi.fn());
const mockMessageError = vi.hoisted(() => vi.fn());
const toolStoreState = vi.hoisted(() => ({
  checkLobehubSkillStatus: vi.fn(),
  createKlavisServer: vi.fn(),
  getLobehubSkillAuthorizeUrl: vi.fn(),
  klavisServerMap: {} as Record<string, any>,
  lobehubServerMap: {} as Record<string, any>,
  refreshKlavisServerTools: vi.fn(),
  removeKlavisServer: vi.fn(),
  revokeLobehubSkill: vi.fn(),
}));

vi.mock('@lobechat/const', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@lobechat/const')>();

  return {
    ...actual,
    getLobehubSkillProviderById: mockGetProvider,
  };
});

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

vi.mock('@/store/tool/selectors', () => ({
  klavisStoreSelectors: {
    getServerByIdentifier: (identifier: string) => (state: any) => state.klavisServerMap[identifier],
  },
  lobehubSkillStoreSelectors: {
    getServerByIdentifier: (identifier: string) =>
      (state: any) => state.lobehubServerMap[identifier],
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

describe('useSkillConnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toolStoreState.klavisServerMap = {};
    toolStoreState.lobehubServerMap = {};
    mockGetProvider.mockReturnValue({ id: 'linear' });
  });

  it('shows an error when Lobehub connect fails', async () => {
    toolStoreState.getLobehubSkillAuthorizeUrl.mockRejectedValue(new Error('connect failed'));

    const { result } = renderHook(() =>
      useSkillConnect({ identifier: 'linear', type: 'lobehub' }),
    );

    await act(async () => {
      await result.current.handleConnect();
    });

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('tools.avatohubSkill.connectError');
    });
  });

  it('shows an error when Lobehub disconnect fails', async () => {
    toolStoreState.lobehubServerMap.linear = {
      identifier: 'linear',
      isConnected: true,
      status: LobehubSkillStatus.CONNECTED,
    };
    toolStoreState.revokeLobehubSkill.mockResolvedValue(false);

    const { result } = renderHook(() =>
      useSkillConnect({ identifier: 'linear', type: 'lobehub' }),
    );

    await act(async () => {
      await result.current.handleDisconnect();
    });

    expect(mockMessageError).toHaveBeenCalledWith('tools.avatohubSkill.disconnectError');
  });

  it('shows an error when Klavis connect fails', async () => {
    toolStoreState.createKlavisServer.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useSkillConnect({ identifier: 'gmail', serverName: 'Gmail', type: 'klavis' }),
    );

    await act(async () => {
      await result.current.handleConnect();
    });

    expect(mockMessageError).toHaveBeenCalledWith('tools.klavis.connectFailed');
  });

  it('shows an error when Klavis disconnect fails', async () => {
    toolStoreState.klavisServerMap.gmail = {
      identifier: 'gmail',
      status: KlavisServerStatus.CONNECTED,
    };
    toolStoreState.removeKlavisServer.mockResolvedValue(false);

    const { result } = renderHook(() =>
      useSkillConnect({ identifier: 'gmail', serverName: 'Gmail', type: 'klavis' }),
    );

    await act(async () => {
      await result.current.handleDisconnect();
    });

    expect(mockMessageError).toHaveBeenCalledWith('tools.klavis.disconnectFailed');
  });
});
