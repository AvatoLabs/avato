/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useProjectItemDropdownMenu } from './useDropdownMenu';

const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockMessage = vi.hoisted(() => ({
  error: vi.fn(),
}));
const mockRemoveSourceSet = vi.hoisted(() => vi.fn());

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

vi.mock('@/features/SourceSetModal', () => ({
  useCreateSourceSetModal: () => ({
    open: vi.fn(),
  }),
}));

vi.mock('@/store/sourceSet', () => ({
  useSourceSetStore: (selector: any) =>
    selector({
      removeSourceSet: mockRemoveSourceSet,
    }),
}));

describe('useProjectItemDropdownMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when deleting a project source set fails', async () => {
    const error = new Error('delete failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRemoveSourceSet.mockRejectedValue(error);

    const { result } = renderHook(() =>
      useProjectItemDropdownMenu({
        id: 'source-set-1',
        name: 'Ops Project',
        toggleEditing: vi.fn(),
      }),
    );

    const items = result.current();
    const deleteItem = items.find((item: any) => item?.key === 'delete') as any;
    deleteItem.onClick();

    const confirmConfig = mockModalConfirm.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockMessage.error).toHaveBeenCalledWith('collection.list.removeError');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to delete project source set:', error);

    consoleErrorSpy.mockRestore();
  });
});
