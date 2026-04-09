/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KlavisAuthorizationList } from './index';

const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockNotificationError = vi.hoisted(() => vi.fn());
const mockRemoveKlavisServer = vi.hoisted(() => vi.fn());

vi.mock('@lobechat/const', () => ({
  KLAVIS_SERVER_TYPES: [
    {
      icon: 'gmail.png',
      identifier: 'gmail',
      label: 'Gmail',
    },
  ],
}));

vi.mock('@lobehub/ui', () => ({
  Avatar: () => null,
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Tag: ({ children, closable, onClose }: any) => (
    <div>
      {children}
      {closable && (
        <button type="button" onClick={onClose}>
          revoke
        </button>
      )}
    </div>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/AntdStaticMethods', () => ({
  modal: {
    confirm: mockModalConfirm,
  },
  notification: {
    error: mockNotificationError,
  },
}));

vi.mock('@/store/tool/store', () => ({
  useToolStore: (selector: any) =>
    selector({
      removeKlavisServer: mockRemoveKlavisServer,
    }),
}));

describe('KlavisAuthorizationList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when revoking an authorization fails', async () => {
    mockRemoveKlavisServer.mockResolvedValue(false);

    render(
      <KlavisAuthorizationList
        servers={[{ identifier: 'gmail', serverName: 'Workspace Gmail' } as any]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'revoke' }));

    const confirmConfig = mockModalConfirm.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockNotificationError).toHaveBeenCalledWith({
      title: 'profile.authorizations.revoke.error',
    });
  });
});
