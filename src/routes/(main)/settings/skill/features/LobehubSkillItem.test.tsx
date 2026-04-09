/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobehubSkillStatus } from '@/store/tool/slices/lobehubSkillStore/types';

import LobehubSkillItem from './LobehubSkillItem';

const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockMessageError = vi.hoisted(() => vi.fn());
const toolStoreState = vi.hoisted(() => ({
  checkLobehubSkillStatus: vi.fn(),
  getLobehubSkillAuthorizeUrl: vi.fn(),
  revokeLobehubSkill: vi.fn(),
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
  createLobehubSkillDetailModal: vi.fn(),
}));

vi.mock('@/store/tool/store', () => ({
  useToolStore: (selector: any) => selector(toolStoreState),
}));

describe('LobehubSkillItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when connecting a skill fails', async () => {
    toolStoreState.getLobehubSkillAuthorizeUrl.mockRejectedValue(new Error('connect failed'));

    render(
      <LobehubSkillItem
        provider={{
          author: 'LobeHub',
          description: 'desc',
          icon: 'icon.png',
          id: 'linear',
          label: 'Linear',
          readme: 'readme',
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'tools.avatohubSkill.connect' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('tools.avatohubSkill.connectError');
    });
  });

  it('shows an error when disconnecting a skill fails', async () => {
    toolStoreState.revokeLobehubSkill.mockResolvedValue(false);

    render(
      <LobehubSkillItem
        provider={{
          author: 'LobeHub',
          description: 'desc',
          icon: 'icon.png',
          id: 'linear',
          label: 'Linear',
          readme: 'readme',
        }}
        server={{
          identifier: 'linear',
          isConnected: true,
          name: 'Linear',
          status: LobehubSkillStatus.CONNECTED,
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

    const confirmConfig = mockModalConfirm.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockMessageError).toHaveBeenCalledWith('tools.avatohubSkill.disconnectError');
  });
});
