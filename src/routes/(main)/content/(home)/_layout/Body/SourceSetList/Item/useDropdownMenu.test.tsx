/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDropdownMenu } from './useDropdownMenu';

const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockMessageError = vi.hoisted(() => vi.fn());
const mockRemoveSourceSet = vi.hoisted(() => vi.fn());
const mockOpen = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Icon: () => null,
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
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/config/contentIcons', () => ({
  RESOURCE_ENTRY_ICONS: {
    edit: () => null,
    page: () => null,
    share: () => null,
    trash: () => null,
  },
}));

vi.mock('@/features/SourceSetModal', () => ({
  useCreateSourceSetModal: () => ({
    open: mockOpen,
  }),
}));

vi.mock('@/store/sourceSet', () => ({
  useSourceSetStore: (selector: any) =>
    selector({
      removeSourceSet: mockRemoveSourceSet,
    }),
}));

describe('SourceSet item dropdown menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when deleting a source set fails', async () => {
    const error = new Error('delete source set failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRemoveSourceSet.mockRejectedValue(error);

    const { result } = renderHook(() =>
      useDropdownMenu({
        description: null,
        id: 'sst_1',
        name: 'Docs',
        onShare: vi.fn(),
        spaceId: 'spc_1',
        toggleEditing: vi.fn(),
      }),
    );

    const menuItems = result.current();
    const deleteItem = menuItems.find((item: any) => item?.key === 'delete') as any;

    deleteItem?.onClick();

    const confirmConfig = mockModalConfirm.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockMessageError).toHaveBeenCalledWith('sourceSet.list.removeError');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to delete source set from content list:',
      error,
    );

    consoleErrorSpy.mockRestore();
  });
});
