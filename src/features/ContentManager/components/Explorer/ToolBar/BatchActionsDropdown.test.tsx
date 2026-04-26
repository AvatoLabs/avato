/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BatchActionsDropdown from './BatchActionsDropdown';

const mockConfirm = vi.hoisted(() => vi.fn());
const mockCreateBatchRightsOwnerModal = vi.hoisted(() => vi.fn());
const mockUpdateFileAssetsGovernance = vi.hoisted(() => vi.fn());
const mockSetSelectedFileIds = vi.hoisted(() => vi.fn());
const mockMessage = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));
const contentManagerState = vi.hoisted(() => ({
  selectedFileIds: ['file-1', 'file-2'],
  sourceSetId: undefined as string | undefined,
  spaceId: 'spc_team',
}));

vi.mock('@lobehub/ui', () => ({
  DropdownMenu: ({ children, items }: any) => (
    <div>
      {children}
      <div>
        {items.flatMap((item: any, index: number) => {
          if (item.type === 'divider') return <hr key={item.key ?? index} />;

          if (item.children) {
            return [
              <button disabled={item.disabled} key={item.key} type="button">
                {item.label}
              </button>,
              ...item.children.map((child: any, childIndex: number) => (
                <button
                  disabled={child.disabled}
                  key={`${item.key}-${child.key ?? childIndex}`}
                  type="button"
                  onClick={() => child.onClick?.()}
                >
                  {child.label}
                </button>
              )),
            ];
          }

          return (
            <button
              disabled={item.disabled}
              key={item.key}
              type="button"
              onClick={() => item.onClick?.()}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  ),
  Icon: () => <span aria-hidden="true" />,
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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      (
        ({
          'FileManager.actions.approveAssets': 'Approve assets',
          'FileManager.actions.approveAssetsSuccess': `${options?.count} assets approved.`,
          'FileManager.actions.archiveAssets': 'Archive assets',
          'FileManager.actions.archiveAssetsSuccess': `${options?.count} assets archived.`,
          'FileManager.actions.confirmArchiveAssets': `Archive ${options?.count} assets?`,
          'FileManager.actions.batchActions': 'Batch actions',
          'FileManager.actions.batchChunking': 'Batch chunking',
          'FileManager.actions.batchChunkingError': 'Batch chunking failed.',
          'FileManager.actions.setAssetClassification': 'Set classification',
          'FileManager.actions.setAssetReviewStatus': 'Set review status',
          'FileManager.actions.setAssetRightsOwner': 'Set rights owner',
          'FileManager.actions.setAssetRightsOwnerHint':
            'Leave this blank to clear the current owner.',
          'FileManager.actions.setAssetRightsOwnerTitle': `Set rights owner for ${options?.count} assets`,
          'FileManager.actions.setAssetUsagePolicy': 'Set usage policy',
          'FileManager.actions.updateClassificationSuccess': `Classification updated for ${options?.count} assets.`,
          'FileManager.actions.updateReviewStatusSuccess': `Review status updated for ${options?.count} assets.`,
          'FileManager.actions.updateRightsOwnerSuccess': `Rights owner updated for ${options?.count} assets.`,
          'FileManager.actions.updateUsagePolicySuccess': `Usage policy updated for ${options?.count} assets.`,
          'detail.asset.classification.legal': 'Legal',
          'detail.asset.reviewStatus.approved': 'Approved',
          'detail.asset.reviewStatus.archived': 'Archived',
          'detail.asset.reviewStatus.draft': 'Draft',
          'detail.asset.rightsOwner.label': 'Rights Owner',
          'detail.asset.rightsOwner.placeholder': 'Enter rights owner',
          'detail.asset.usagePolicy.restricted': 'Restricted',
          'FileManager.actions.deleteError': 'Delete failed.',
          'FileManager.actions.removeFromSourceSetError': 'Remove from source set failed.',
          'sourceSet.list.removeError': 'Delete source set failed.',
          'delete': 'Delete',
        }) as Record<string, string>
      )[key] || key,
  }),
}));

vi.mock('@/config/contentIcons', () => ({
  RESOURCE_ENTRY_ICONS: {
    archive: () => null,
    check: () => null,
    chunk: () => null,
    more: () => null,
    sourceSet: () => null,
    sourceSetAdd: () => null,
    sourceSetRemove: () => null,
    trash: () => null,
  },
}));

vi.mock('@/routes/(main)/content/features/store', () => ({
  useContentManagerStore: (selector: any) =>
    selector({
      selectedFileIds: contentManagerState.selectedFileIds,
      setSelectedFileIds: mockSetSelectedFileIds,
      sourceSetId: contentManagerState.sourceSetId,
      spaceId: contentManagerState.spaceId,
    }),
}));

vi.mock('@/store/file', () => ({
  useFileStore: (selector: any) =>
    selector({
      updateFileAssetsGovernance: mockUpdateFileAssetsGovernance,
    }),
}));

vi.mock('@/store/sourceSet', () => ({
  useSourceSetStore: (selector: any) =>
    selector({
      addFilesToSourceSet: vi.fn(),
      useFetchSourceSetList: () => ({ data: [] }),
    }),
}));

vi.mock('./BatchRightsOwnerModal', () => ({
  createBatchRightsOwnerModal: mockCreateBatchRightsOwnerModal,
}));

vi.mock('./ActionIconWithChevron', () => ({
  default: ({ title }: any) => <button type="button">{title}</button>,
}));

describe('BatchActionsDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contentManagerState.selectedFileIds = ['file-1', 'file-2'];
    contentManagerState.sourceSetId = undefined;
    contentManagerState.spaceId = 'spc_team';
    mockConfirm.mockImplementation(({ onOk }: any) => onOk?.());
    mockCreateBatchRightsOwnerModal.mockImplementation(({ onSubmit }: any) => onSubmit?.('Brand Team'));
  });

  it('should expose approve and archive batch actions', async () => {
    const onActionClick = vi.fn().mockResolvedValue(undefined);

    render(
      <BatchActionsDropdown
        governanceCapabilities={{ canApprove: true, canArchive: true, canEditGovernance: true }}
        selectCount={2}
        onActionClick={onActionClick}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Approve assets' }));
    await waitFor(() => {
      expect(onActionClick).toHaveBeenCalledWith('approveAssets');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Archive assets' }));
    await waitFor(() => {
      expect(onActionClick).toHaveBeenCalledWith('archiveAssets');
    });
  });

  it('should apply batch governance metadata updates from submenu items', async () => {
    const onActionClick = vi.fn().mockResolvedValue(undefined);
    mockUpdateFileAssetsGovernance.mockResolvedValue(undefined);

    render(
      <BatchActionsDropdown
        governanceCapabilities={{ canApprove: true, canArchive: true, canEditGovernance: true }}
        selectCount={2}
        onActionClick={onActionClick}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Legal' }));
    await waitFor(() => {
      expect(mockUpdateFileAssetsGovernance).toHaveBeenCalledWith(['file-1', 'file-2'], {
        classification: 'legal',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Restricted' }));
    await waitFor(() => {
      expect(mockUpdateFileAssetsGovernance).toHaveBeenCalledWith(['file-1', 'file-2'], {
        usagePolicy: 'restricted',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
    await waitFor(() => {
      expect(mockUpdateFileAssetsGovernance).toHaveBeenCalledWith(['file-1', 'file-2'], {
        reviewStatus: 'draft',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Approved' }));
    await waitFor(() => {
      expect(mockUpdateFileAssetsGovernance).toHaveBeenCalledWith(['file-1', 'file-2'], {
        reviewStatus: 'approved',
      });
    });

    expect(mockSetSelectedFileIds).toHaveBeenCalledWith([]);
    expect(onActionClick).not.toHaveBeenCalledWith('approveAssets');
    expect(onActionClick).not.toHaveBeenCalledWith('archiveAssets');
  });

  it('should open a modal and apply batch rights owner updates', async () => {
    const onActionClick = vi.fn().mockResolvedValue(undefined);
    mockUpdateFileAssetsGovernance.mockResolvedValue(undefined);

    render(
      <BatchActionsDropdown
        governanceCapabilities={{ canApprove: true, canArchive: true, canEditGovernance: true }}
        selectCount={2}
        onActionClick={onActionClick}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set rights owner' }));

    expect(mockCreateBatchRightsOwnerModal).toHaveBeenCalledWith({
      count: 2,
      onSubmit: expect.any(Function),
    });

    await waitFor(() => {
      expect(mockUpdateFileAssetsGovernance).toHaveBeenCalledWith(['file-1', 'file-2'], {
        rightsOwner: 'Brand Team',
      });
    });

    expect(mockSetSelectedFileIds).toHaveBeenCalledWith([]);
    expect(onActionClick).not.toHaveBeenCalled();
  });

  it('should hide governance actions for viewers without governance capabilities', () => {
    const onActionClick = vi.fn().mockResolvedValue(undefined);

    render(
      <BatchActionsDropdown
        governanceCapabilities={{ canApprove: false, canArchive: false, canEditGovernance: false }}
        selectCount={2}
        onActionClick={onActionClick}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Approve assets' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive assets' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Set classification' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Set review status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Set rights owner' })).not.toBeInTheDocument();
  });

  it('should only expose draft review status to editors without approve/archive permissions', () => {
    const onActionClick = vi.fn().mockResolvedValue(undefined);

    render(
      <BatchActionsDropdown
        governanceCapabilities={{ canApprove: false, canArchive: false, canEditGovernance: true }}
        selectCount={2}
        onActionClick={onActionClick}
      />,
    );

    expect(screen.getByRole('button', { name: 'Set review status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Draft' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approved' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archived' })).not.toBeInTheDocument();
  });

  it('shows an error when deleting selected files fails', async () => {
    const onActionClick = vi.fn().mockRejectedValue(new Error('delete failed'));

    render(
      <BatchActionsDropdown
        governanceCapabilities={{ canApprove: false, canArchive: false, canEditGovernance: false }}
        selectCount={2}
        onActionClick={onActionClick}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(onActionClick).toHaveBeenCalledWith('delete');
    });
    expect(mockMessage.error).toHaveBeenCalledWith('Delete failed.');
  });

  it('shows an error when deleting the current source set fails', async () => {
    contentManagerState.sourceSetId = 'source-set-1';
    contentManagerState.selectedFileIds = [];
    const onActionClick = vi.fn().mockRejectedValue(new Error('delete source set failed'));

    render(
      <BatchActionsDropdown
        governanceCapabilities={{ canApprove: false, canArchive: false, canEditGovernance: false }}
        selectCount={0}
        onActionClick={onActionClick}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'header.actions.deleteSourceSet' }));

    await waitFor(() => {
      expect(onActionClick).toHaveBeenCalledWith('deleteSourceSet');
    });
    expect(mockMessage.error).toHaveBeenCalledWith('Delete source set failed.');
  });
});
