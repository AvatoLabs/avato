/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KlavisServerStatus } from '@/store/tool/slices/klavisStore';

import KlavisSkillItem from './KlavisSkillItem';

const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockMessageError = vi.hoisted(() => vi.fn());
const toolStoreState = vi.hoisted(() => ({
  createKlavisServer: vi.fn(),
  refreshKlavisServerTools: vi.fn(),
  removeKlavisServer: vi.fn(),
}));

vi.mock('@lobehub/ui', () => ({
  Avatar: () => null,
  Button: ({ children, disabled, onClick }: any) => (
    <button disabled={disabled} type="button" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenu: ({ children, items }: any) => (
    <div>
      {children}
      {items?.map((item: any) => (
        <button key={item.key} type="button" onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </div>
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Icon: () => null,
  Tag: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('antd', () => ({
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
  Button: ({ children, disabled, icon, onClick, type }: any) => (
    <button disabled={disabled} type={type || 'button'} onClick={onClick}>
      {icon}
      {children}
    </button>
  ),
}));

vi.mock('antd-style', () => ({
  createStaticStyles: (factory: any) =>
    factory({
      css: () => '',
      cssVar: {
        colorError: '#f00',
        colorFillTertiary: '#f5f5f5',
        colorPrimary: '#1677ff',
        colorSuccess: '#0f0',
        colorText: '#000',
        colorTextTertiary: '#666',
        colorWarning: '#faad14',
      },
    }),
  cssVar: {
    colorText: '#000',
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@/features/SkillStore/SkillDetail', () => ({
  createKlavisSkillDetailModal: vi.fn(),
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

describe('KlavisSkillItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when connecting a server fails', async () => {
    toolStoreState.createKlavisServer.mockResolvedValue(undefined);

    render(
      <KlavisSkillItem
        serverType={{
          author: 'Klavis',
          description: 'desc',
          icon: 'icon.png',
          identifier: 'gmail',
          label: 'Gmail',
          readme: 'readme',
          serverName: 'Gmail',
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('tools.klavis.connectFailed');
    });
  });

  it('shows an error when disconnecting a server fails', async () => {
    toolStoreState.removeKlavisServer.mockResolvedValue(false);

    render(
      <KlavisSkillItem
        server={{
          createdAt: Date.now(),
          identifier: 'gmail',
          instanceId: 'inst-1',
          isAuthenticated: true,
          serverName: 'Gmail',
          serverUrl: 'https://klavis.example/gmail',
          status: KlavisServerStatus.CONNECTED,
        }}
        serverType={{
          author: 'Klavis',
          description: 'desc',
          icon: 'icon.png',
          identifier: 'gmail',
          label: 'Gmail',
          readme: 'readme',
          serverName: 'Gmail',
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

    const confirmConfig = mockModalConfirm.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockMessageError).toHaveBeenCalledWith('tools.klavis.disconnectFailed');
  });
});
