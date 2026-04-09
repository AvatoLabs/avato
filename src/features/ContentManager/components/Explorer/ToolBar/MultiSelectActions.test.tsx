/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MultiSelectActions from './MultiSelectActions';

const mockConfirm = vi.hoisted(() => vi.fn());
const mockMessage = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));
const contentManagerState = vi.hoisted(() => ({
  sourceSetId: undefined as string | undefined,
}));

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Checkbox: () => <input readOnly type="checkbox" />,
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Icon: () => null,
  Skeleton: () => <div>loading</div>,
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: mockMessage,
      modal: {
        confirm: mockConfirm,
      },
    }),
  },
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    total: 'total',
  }),
  cssVar: {
    colorBorderSecondary: '#ddd',
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      (
        {
          'FileManager.actions.addToSourceSet': 'Add to source set',
          'FileManager.actions.approveAssets': 'Approve assets',
          'FileManager.actions.approveAssetsError': 'Approve failed.',
          'FileManager.actions.archiveAssets': 'Archive assets',
          'FileManager.actions.archiveAssetsError': 'Archive failed.',
          'FileManager.actions.batchChunking': 'Batch chunking',
          'FileManager.actions.batchChunkingError': 'Batch chunking failed.',
          'FileManager.actions.confirmDeleteMultiFiles': `Delete ${options?.count} files?`,
          'FileManager.actions.deleteError': 'Delete failed.',
          'FileManager.actions.moveToOtherSourceSet': 'Move to other source set',
          'FileManager.total.selectedCount': `${options?.count} selected`,
          delete: 'Delete',
        }[key] || key
      ),
  }),
}));

vi.mock('@/config/contentIcons', () => ({
  RESOURCE_ENTRY_ICONS: {
    archive: () => null,
    check: () => null,
    chunk: () => null,
    sourceSetAdd: () => null,
    sourceSetRemove: () => null,
    trash: () => null,
  },
}));

vi.mock('@/routes/(main)/content/features/store', () => ({
  useContentManagerStore: (selector: any) =>
    selector({
      sourceSetId: contentManagerState.sourceSetId,
    }),
}));

describe('MultiSelectActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contentManagerState.sourceSetId = undefined;
    mockConfirm.mockImplementation(({ onOk }: any) => onOk?.());
  });

  it('shows an error when batch chunking fails', async () => {
    const onActionClick = vi.fn().mockRejectedValue(new Error('chunk failed'));

    render(
      <MultiSelectActions
        onActionClick={onActionClick}
        onClickCheckbox={vi.fn()}
        selectCount={2}
        total={2}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Batch chunking' }));
    });

    expect(onActionClick).toHaveBeenCalledWith('batchChunking');
    expect(mockMessage.error).toHaveBeenCalledWith('Batch chunking failed.');
  });

  it('shows an error when batch delete fails', async () => {
    const onActionClick = vi.fn().mockRejectedValue(new Error('delete failed'));

    render(
      <MultiSelectActions
        onActionClick={onActionClick}
        onClickCheckbox={vi.fn()}
        selectCount={2}
        total={2}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    });

    expect(onActionClick).toHaveBeenCalledWith('delete');
    expect(mockMessage.error).toHaveBeenCalledWith('Delete failed.');
  });
});
