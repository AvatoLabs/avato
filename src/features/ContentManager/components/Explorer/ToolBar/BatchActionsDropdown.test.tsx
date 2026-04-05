/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BatchActionsDropdown from './BatchActionsDropdown';

const mockConfirm = vi.hoisted(() => vi.fn());
const mockUpdateFileAssetsGovernance = vi.hoisted(() => vi.fn());
const mockSetSelectedFileIds = vi.hoisted(() => vi.fn());

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
      message: {
        error: vi.fn(),
        success: vi.fn(),
      },
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
          'FileManager.actions.setAssetClassification': 'Set classification',
          'FileManager.actions.setAssetUsagePolicy': 'Set usage policy',
          'FileManager.actions.updateClassificationSuccess': `Classification updated for ${options?.count} assets.`,
          'FileManager.actions.updateUsagePolicySuccess': `Usage policy updated for ${options?.count} assets.`,
          'detail.asset.classification.legal': 'Legal',
          'detail.asset.usagePolicy.restricted': 'Restricted',
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
      selectedFileIds: ['file-1', 'file-2'],
      setSelectedFileIds: mockSetSelectedFileIds,
      sourceSetId: undefined,
      spaceId: 'spc_team',
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

vi.mock('./ActionIconWithChevron', () => ({
  default: ({ title }: any) => <button type="button">{title}</button>,
}));

describe('BatchActionsDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockImplementation(({ onOk }: any) => onOk?.());
  });

  it('should expose approve and archive batch actions', async () => {
    const onActionClick = vi.fn().mockResolvedValue(undefined);

    render(<BatchActionsDropdown selectCount={2} onActionClick={onActionClick} />);

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

    render(<BatchActionsDropdown selectCount={2} onActionClick={onActionClick} />);

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

    expect(mockSetSelectedFileIds).toHaveBeenCalledWith([]);
    expect(onActionClick).not.toHaveBeenCalledWith('approveAssets');
    expect(onActionClick).not.toHaveBeenCalledWith('archiveAssets');
  });
});
