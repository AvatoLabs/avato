/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Actions from './Actions';

const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockMessage = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));
const mockRemoveAgentGroup = vi.hoisted(() => vi.fn());
const mockRemoveSession = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  ActionIcon: () => <button type="button">trigger</button>,
  DropdownMenu: ({ items }: any) => (
    <div>
      {items.map((item: any, index: number) => {
        if (!item || item.type === 'divider') return <hr key={index} />;
        if (item.children) return <button key={item.key}>{item.label}</button>;

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

vi.mock('@/store/global', () => ({
  useGlobalStore: (selector: any) => selector({ openAgentInNewWindow: vi.fn() }),
}));

vi.mock('@/store/home/store', () => ({
  useHomeStore: (selector: any) =>
    selector({
      pinAgentGroup: vi.fn(),
      removeAgentGroup: mockRemoveAgentGroup,
    }),
}));

vi.mock('@/store/session', () => ({
  sessionHelpers: {
    getSessionPinned: () => false,
  },
  useSessionStore: (selector: any) =>
    selector({
      duplicateSession: vi.fn(),
      pinSession: vi.fn(),
      removeSession: mockRemoveSession,
      updateSessionGroupId: vi.fn(),
    }),
}));

vi.mock('@/store/session/helpers', () => ({
  sessionHelpers: {
    getSessionPinned: () => false,
  },
}));

vi.mock('@/store/session/selectors', () => ({
  sessionGroupSelectors: {
    sessionGroupItems: () => [],
  },
  sessionSelectors: {
    getSessionById: () => () => ({
      type: 'agent',
    }),
  },
}));

describe('Mobile session list item actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when deleting an agent fails', async () => {
    const error = new Error('delete failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRemoveSession.mockRejectedValue(error);

    render(
      <Actions
        group={undefined}
        id="session-1"
        openCreateGroupModal={vi.fn()}
        parentType="agent"
        setOpen={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'delete' }));

    const confirmConfig = mockModalConfirm.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockMessage.error).toHaveBeenCalledWith('confirmRemoveSessionError');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to delete mobile session list item:',
      error,
    );

    consoleErrorSpy.mockRestore();
  });

  it('shows an error when deleting a group fails', async () => {
    const error = new Error('delete failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRemoveAgentGroup.mockRejectedValue(error);

    render(
      <Actions
        group={undefined}
        id="group-1"
        openCreateGroupModal={vi.fn()}
        parentType="group"
        setOpen={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'delete' }));

    const confirmConfig = mockModalConfirm.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockMessage.error).toHaveBeenCalledWith('confirmRemoveGroupError');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to delete mobile session list item:',
      error,
    );

    consoleErrorSpy.mockRestore();
  });
});
