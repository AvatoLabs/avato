/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SSOProvidersList } from './index';

const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockNotificationError = vi.hoisted(() => vi.fn());
const mockLinkSocial = vi.hoisted(() => vi.fn());
const mockOauthLink = vi.hoisted(() => vi.fn());
const mockRefreshAuthProviders = vi.hoisted(() => vi.fn());
const userStoreState = vi.hoisted(() => ({
  hasPasswordAccount: true,
  isLogin: true,
  providers: [
    { email: 'user@example.com', provider: 'github', providerAccountId: 'acct-1' },
  ] as any[],
}));
const serverConfigState = vi.hoisted(() => ({
  oAuthSSOProviders: [] as string[],
}));

vi.mock('@lobechat/const', () => ({
  isDesktop: false,
}));

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      unlink
    </button>
  ),
  DropdownMenu: ({ items }: any) => (
    <div>
      {items?.map((item: any) => (
        <button key={item.key} type="button" onClick={item.onClick}>
          {item.key}
        </button>
      ))}
    </div>
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Text: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('@/components/AntdStaticMethods', () => ({
  modal: {
    confirm: mockModalConfirm,
  },
  notification: {
    error: mockNotificationError,
  },
}));

vi.mock('@/components/AuthIcons', () => ({
  default: () => null,
}));

vi.mock('@/libs/better-auth/auth-client', () => ({
  linkSocial: mockLinkSocial,
  oauth2: {
    link: mockOauthLink,
  },
  unlinkAccount: vi.fn().mockRejectedValue(new Error('unlink failed')),
}));

vi.mock('@/libs/better-auth/utils/client', () => ({
  isBuiltinProvider: (provider: string) => provider === 'google',
  normalizeProviderId: (provider: string) => provider,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/store/serverConfig', () => ({
  useServerConfigStore: (selector: any) => selector(serverConfigState),
}));

vi.mock('@/store/serverConfig/selectors', () => ({
  serverConfigSelectors: {
    oAuthSSOProviders: (state: typeof serverConfigState) => state.oAuthSSOProviders,
  },
}));

vi.mock('@/store/user', () => ({
  useUserStore: (selector: any) =>
    selector({
      hasPasswordAccount: userStoreState.hasPasswordAccount,
      isLogin: userStoreState.isLogin,
      providers: userStoreState.providers,
      refreshAuthProviders: mockRefreshAuthProviders,
    }),
}));

vi.mock('@/store/user/selectors', () => ({
  authSelectors: {
    authProviders: (state: typeof userStoreState) => userStoreState.providers,
    hasPasswordAccount: (state: typeof userStoreState) => state.hasPasswordAccount,
    isLogin: (state: typeof userStoreState) => state.isLogin,
  },
}));

describe('SSOProvidersList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userStoreState.hasPasswordAccount = true;
    userStoreState.isLogin = true;
    userStoreState.providers = [
      { email: 'user@example.com', provider: 'github', providerAccountId: 'acct-1' },
    ] as any[];
    serverConfigState.oAuthSSOProviders = [];
  });

  it('shows an error notification when unlinking a provider fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<SSOProvidersList />);

    fireEvent.click(screen.getByRole('button', { name: 'unlink' }));

    const confirmConfig = mockModalConfirm.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockNotificationError).toHaveBeenCalledWith({
      title: 'profile.sso.unlink.error',
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to unlink SSO provider:',
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });

  it('shows an error notification when linking a provider fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    userStoreState.providers = [] as any[];
    serverConfigState.oAuthSSOProviders = ['google'];
    mockLinkSocial.mockRejectedValue(new Error('link failed'));

    render(<SSOProvidersList />);

    fireEvent.click(screen.getByRole('button', { name: 'google' }));

    await waitFor(() => {
      expect(mockNotificationError).toHaveBeenCalledWith({
        title: 'profile.sso.link.error',
      });
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to link SSO provider:',
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });
});
