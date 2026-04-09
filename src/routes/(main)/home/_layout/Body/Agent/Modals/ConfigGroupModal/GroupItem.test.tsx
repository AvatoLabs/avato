/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import GroupItem from './GroupItem';

const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockMessage = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));
const mockRemoveGroup = vi.hoisted(() => vi.fn());
const mockUpdateGroupName = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ icon, onClick }: any) => (
    <button aria-label={String(icon)} type="button" onClick={onClick}>
      {String(icon)}
    </button>
  ),
  EditableText: ({ onChangeEnd, onEditingChange }: any) => (
    <button
      aria-label="EditableText"
      type="button"
      onClick={async () => {
        await onChangeEnd('Renamed Group');
        onEditingChange(false);
      }}
    >
      editable
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

vi.mock('lucide-react', () => ({
  PencilLine: 'PencilLine',
  Trash: 'Trash',
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/store/home/store', () => ({
  useHomeStore: (selector: any) =>
    selector({
      removeGroup: mockRemoveGroup,
      updateGroupName: mockUpdateGroupName,
    }),
}));

describe('ConfigGroupModal GroupItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when deleting a group fails', async () => {
    const error = new Error('delete failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRemoveGroup.mockRejectedValue(error);

    render(<GroupItem id="group-1" name="Ops" />);

    fireEvent.click(screen.getByRole('button', { name: 'Trash' }));

    const confirmConfig = mockModalConfirm.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockMessage.error).toHaveBeenCalledWith('confirmRemoveGroupError');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to delete session group from config modal:',
      error,
    );

    consoleErrorSpy.mockRestore();
  });

  it('shows an error when renaming a group fails', async () => {
    const error = new Error('rename failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUpdateGroupName.mockRejectedValue(error);

    render(<GroupItem id="group-1" name="Ops" />);

    fireEvent.click(screen.getByRole('button', { name: 'PencilLine' }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'EditableText' }));
    });

    expect(mockMessage.error).toHaveBeenCalledWith('sessionGroup.renameError');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to rename session group:', error);

    consoleErrorSpy.mockRestore();
  });
});
