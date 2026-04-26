/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Actions from './Actions';

const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockMessage = vi.hoisted(() => ({
  destroy: vi.fn(),
  error: vi.fn(),
  loading: vi.fn(),
  success: vi.fn(),
}));
const mockCreateSession = vi.hoisted(() => vi.fn());
const mockRemoveSessionGroup = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      trigger
    </button>
  ),
  DropdownMenu: ({ items }: any) => (
    <div>
      {items.map((item: any, index: number) => {
        if (!item || item.type === 'divider') return <hr key={index} />;

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => item.onClick?.({ domEvent: { stopPropagation: vi.fn() } })}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  ),
  Icon: () => null,
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: mockMessage,
      modal: {
        confirm: mockModalConfirm,
      },
    }),
  },
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    modalRoot: 'modal-root',
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/MemberSelectionModal', () => ({
  MemberSelectionModal: () => null,
}));

vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => true,
}));

vi.mock('@/store/agentGroup', () => ({
  useAgentGroupStore: (selector: any) =>
    selector({
      createGroup: vi.fn(),
    }),
}));

vi.mock('@/store/session', () => ({
  useSessionStore: (selector: any) =>
    selector({
      createSession: mockCreateSession,
      removeSessionGroup: mockRemoveSessionGroup,
    }),
}));

describe('Mobile collapse-group actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error and clears loading when creating an agent fails', async () => {
    const error = new Error('create failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCreateSession.mockRejectedValue(error);

    render(
      <Actions id="group-1" isPinned openConfigModal={vi.fn()} onOpenChange={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'newAgent' }));

    await waitFor(() => {
      expect(mockMessage.error).toHaveBeenCalledWith({ content: 'createAgentFailed' });
    });

    expect(mockMessage.destroy).toHaveBeenCalledWith('createNewAgentInGroup');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to create agent in mobile session group:',
      error,
    );

    consoleErrorSpy.mockRestore();
  });

  it('shows an error when deleting a custom group fails', async () => {
    const error = new Error('delete failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRemoveSessionGroup.mockRejectedValue(error);

    render(
      <Actions
        id="group-1"
        isCustomGroup
        openConfigModal={vi.fn()}
        openRenameModal={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'delete' }));

    const confirmConfig = mockModalConfirm.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockMessage.error).toHaveBeenCalledWith({ content: 'confirmRemoveGroupError' });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to delete mobile session group:', error);

    consoleErrorSpy.mockRestore();
  });
});
