/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import OAuthDeviceFlowAuth from './index';

const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockMessageError = vi.hoisted(() => vi.fn());
const mockInvalidate = vi.hoisted(() => vi.fn());
const mockRevokeMutateAsync = vi.hoisted(() => vi.fn());

vi.mock('@ant-design/icons', () => ({
  CheckCircleFilled: () => null,
}));

vi.mock('@lobehub/icons', () => ({
  ProviderIcon: () => null,
}));

vi.mock('@lobehub/ui', () => ({
  CopyButton: () => null,
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Icon: () => null,
}));

vi.mock('antd', () => {
  const Typography = {
    Link: ({ children, href }: any) => <a href={href}>{children}</a>,
    Text: ({ children }: any) => <span>{children}</span>,
  };

  return {
    App: {
      useApp: () => ({
        message: {
          error: mockMessageError,
        },
        modal: {
          confirm: mockModalConfirm,
        },
      }),
    },
    Avatar: () => null,
    Button: ({ children, onClick }: any) => (
      <button type="button" onClick={onClick}>
        {children}
      </button>
    ),
    Typography,
  };
});

vi.mock('antd-style', () => ({
  createStyles: () => () => ({
    styles: new Proxy(
      {},
      {
        get: () => '',
      },
    ),
  }),
  cssVar: {
    colorError: '',
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaQuery: {
    oauthDeviceFlow: {
      getAuthStatus: {
        useQuery: () => ({
          data: {
            avatarUrl: 'https://example.com/avatar.png',
            isAuthenticated: true,
            username: 'tester',
          },
        }),
      },
      revokeAuth: {
        useMutation: () => ({
          isPending: false,
          mutateAsync: mockRevokeMutateAsync,
        }),
      },
    },
    useUtils: () => ({
      oauthDeviceFlow: {
        getAuthStatus: {
          invalidate: mockInvalidate,
        },
      },
    }),
  },
}));

vi.mock('./useOAuthDeviceFlow', () => ({
  useOAuthDeviceFlow: () => ({
    cancelAuth: vi.fn(),
    deviceCodeInfo: undefined,
    error: undefined,
    startAuth: vi.fn(),
    state: 'idle',
  }),
}));

describe('OAuthDeviceFlowAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when disconnecting a provider fails', async () => {
    const error = new Error('disconnect failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRevokeMutateAsync.mockRejectedValue(error);

    render(<OAuthDeviceFlowAuth name="OpenAI" providerId="openai" />);

    fireEvent.click(screen.getByRole('button', { name: 'providerModels.config.oauth.disconnect' }));

    const confirmConfig = mockModalConfirm.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockMessageError).toHaveBeenCalledWith('providerModels.config.oauth.disconnectError');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to disconnect OAuth provider:', error);

    consoleErrorSpy.mockRestore();
  });
});
