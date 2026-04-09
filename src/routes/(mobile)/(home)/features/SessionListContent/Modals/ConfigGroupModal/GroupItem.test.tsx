/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import GroupItem from './GroupItem';

const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockMessage = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));
const mockRemoveSessionGroup = vi.hoisted(() => vi.fn());
const mockUpdateSessionGroupName = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      action
    </button>
  ),
  EditableText: ({ onChangeEnd, value }: any) => (
    <button type="button" onClick={() => onChangeEnd('Renamed')}>
      {value}
    </button>
  ),
  SortableList: {
    DragHandle: () => <div>drag</div>,
  },
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
    content: 'content',
    title: 'title',
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/store/session', () => ({
  useSessionStore: (selector: any) =>
    selector({
      removeSessionGroup: mockRemoveSessionGroup,
      updateSessionGroupName: mockUpdateSessionGroupName,
    }),
}));

describe('Mobile config group modal item', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when deleting a group fails', async () => {
    const error = new Error('delete failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRemoveSessionGroup.mockRejectedValue(error);

    render(<GroupItem createdAt={new Date()} id="group-1" name="Ops" updatedAt={new Date()} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'action' })[1]);

    const confirmConfig = mockModalConfirm.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockMessage.error).toHaveBeenCalledWith('confirmRemoveGroupError');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to delete mobile session group from config modal:',
      error,
    );

    consoleErrorSpy.mockRestore();
  });

  it('shows an error when renaming a group fails', async () => {
    const error = new Error('rename failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUpdateSessionGroupName.mockRejectedValue(error);

    render(<GroupItem createdAt={new Date()} id="group-1" name="Ops" updatedAt={new Date()} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'action' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Ops' }));

    await waitFor(() => {
      expect(mockMessage.error).toHaveBeenCalledWith('sessionGroup.renameError');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to rename mobile session group:',
      error,
    );

    consoleErrorSpy.mockRestore();
  });
});
