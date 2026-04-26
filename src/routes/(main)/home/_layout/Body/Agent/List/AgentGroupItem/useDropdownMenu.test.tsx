/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useGroupDropdownMenu } from './useDropdownMenu';

const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockMessage = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));
const mockRemoveAgentGroup = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/EditingPopover/store', () => ({
  openEditingPopover: vi.fn(),
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: (selector: any) =>
    selector({
      openAgentInNewWindow: vi.fn(),
    }),
}));

vi.mock('@/store/home/store', () => ({
  useHomeStore: (selector: any) =>
    selector({
      duplicateAgentGroup: vi.fn(),
      pinAgentGroup: vi.fn(),
      removeAgentGroup: mockRemoveAgentGroup,
    }),
}));

describe('useGroupDropdownMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when deleting a group fails', async () => {
    const error = new Error('delete failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRemoveAgentGroup.mockRejectedValue(error);

    const { result } = renderHook(() =>
      useGroupDropdownMenu({
        anchor: null,
        id: 'group-1',
        pinned: false,
        title: 'Ops',
      }),
    );

    const items = result.current();
    const deleteItem = items.find((item: any) => item?.key === 'delete') as any;

    deleteItem.onClick({ domEvent: { stopPropagation: vi.fn() } });

    const confirmConfig = mockModalConfirm.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockMessage.error).toHaveBeenCalledWith('confirmRemoveGroupError');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to delete agent group:', error);

    consoleErrorSpy.mockRestore();
  });
});
