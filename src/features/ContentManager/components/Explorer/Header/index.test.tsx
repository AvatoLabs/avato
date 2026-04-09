/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Header from './index';

const contentManagerState = vi.hoisted(() => ({
  currentViewItemId: undefined as string | undefined,
  onActionClick: vi.fn(),
  selectedFileIds: ['file-1', 'file-2'] as string[],
  setSelectedFileIds: vi.fn(),
  sourceSetId: undefined as string | undefined,
}));

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ title }: any) => <button type="button">{title}</button>,
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Text: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: vi.fn(),
        success: vi.fn(),
      },
      modal: {
        confirm: vi.fn(),
      },
    }),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; defaultValue?: string; ns?: string }) =>
      (
        ({
          'FileManager.actions.approveAssets': 'Approve assets',
          'FileManager.actions.archiveAssets': 'Archive assets',
          'FileManager.actions.batchActions': 'Batch actions',
          'FileManager.actions.batchChunking': 'Batch chunking',
          'FileManager.actions.confirmArchiveAssets': `Archive ${options?.count} assets?`,
          'FileManager.actions.confirmDeleteMultiFiles': `Delete ${options?.count} files?`,
          'FileManager.actions.deleteSuccess': 'Deleted',
          'FileManager.total.selectedCount': `Selected ${options?.count} items`,
          close: 'Close',
          delete: 'Delete',
          tab: options?.defaultValue,
        }) as Record<string, string | undefined>
      )[key] || key,
  }),
}));

vi.mock('@/config/contentIcons', () => ({
  RESOURCE_ENTRY_ICONS: {
    archive: 'archive',
    check: 'check',
    chunk: 'chunk',
    trash: 'trash',
  },
}));

vi.mock('@/features/NavHeader', () => ({
  default: ({ children, left, right }: any) => (
    <div>
      <div data-testid="left">{left}</div>
      <div data-testid="center">{children}</div>
      <div data-testid="right">{right}</div>
    </div>
  ),
}));

vi.mock('@/routes/(main)/content/(home)/_layout/Header/CategoryMenu', () => ({
  default: () => <div>category-menu</div>,
}));

vi.mock('@/routes/(main)/content/features/hooks/useFolderPath', () => ({
  useFolderPath: () => ({
    currentFolderSlug: null,
  }),
}));

vi.mock('@/routes/(main)/content/features/store', () => ({
  selectors: {
    getCurrentFile: () => undefined,
  },
  useContentManagerStore: (selector: any) => selector(contentManagerState),
}));

vi.mock('@/store/serverConfig', () => ({
  useServerConfigStore: (selector: any) =>
    selector({
      isMobile: false,
    }),
}));

vi.mock('../../Header/AddButton', () => ({
  default: () => <div>add-button</div>,
}));

vi.mock('../ToolBar/BatchActionsDropdown', () => ({
  default: ({ governanceCapabilities }: any) => (
    <div data-testid="batch-dropdown">{JSON.stringify(governanceCapabilities ?? null)}</div>
  ),
}));

vi.mock('../ToolBar/SortDropdown', () => ({
  default: () => <div>sort-dropdown</div>,
}));

vi.mock('../ToolBar/ViewSwitcher', () => ({
  default: () => <div>view-switcher</div>,
}));

vi.mock('./Breadcrumb', () => ({
  default: () => <div>breadcrumb</div>,
}));

vi.mock('./SearchInput', () => ({
  default: () => <div>search-input</div>,
}));

describe('Explorer Header', () => {
  it('drops the duplicated root space title and keeps the normal explorer controls', () => {
    contentManagerState.selectedFileIds = [];
    contentManagerState.currentViewItemId = undefined;
    contentManagerState.sourceSetId = undefined;

    render(
      <Header
        governanceCapabilities={{
          canApprove: false,
          canArchive: false,
          canEditGovernance: true,
        }}
      />,
    );

    expect(screen.queryByText('Files')).not.toBeInTheDocument();
    expect(screen.queryByText('breadcrumb')).not.toBeInTheDocument();
    expect(screen.getByTestId('center')).toHaveTextContent('category-menu');
    expect(screen.getByTestId('right')).toHaveTextContent('search-input');
    expect(screen.getByTestId('right')).toHaveTextContent('sort-dropdown');
    expect(screen.getByTestId('right')).toHaveTextContent('view-switcher');
    expect(screen.getByTestId('right')).toHaveTextContent('add-button');
  });

  it('hides approve and archive actions when governance capabilities do not allow them', () => {
    contentManagerState.selectedFileIds = ['file-1', 'file-2'];

    render(
      <Header
        governanceCapabilities={{
          canApprove: false,
          canArchive: false,
          canEditGovernance: true,
        }}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Approve assets' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive assets' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Batch chunking' })).not.toBeInTheDocument();
    expect(screen.getByTestId('batch-dropdown')).toHaveTextContent(
      '{"canApprove":false,"canArchive":false,"canEditGovernance":true}',
    );
  });

  it('keeps multi-selection actions consolidated in the batch menu even when governance actions are available', () => {
    contentManagerState.selectedFileIds = ['file-1', 'file-2'];

    render(
      <Header
        governanceCapabilities={{
          canApprove: true,
          canArchive: true,
          canEditGovernance: true,
        }}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Approve assets' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive assets' })).not.toBeInTheDocument();
    expect(screen.getByTestId('batch-dropdown')).toBeInTheDocument();
  });

  it('turns multi-selection into a dedicated selection toolbar', () => {
    contentManagerState.selectedFileIds = ['file-1', 'file-2'];

    render(
      <Header
        governanceCapabilities={{
          canApprove: false,
          canArchive: false,
          canEditGovernance: true,
        }}
      />,
    );

    expect(screen.getByText('Batch actions')).toBeInTheDocument();
    expect(screen.getByText('Selected 2 items')).toBeInTheDocument();
    expect(screen.queryByText('category-menu')).not.toBeInTheDocument();
    expect(screen.queryByText('search-input')).not.toBeInTheDocument();
    expect(screen.queryByText('sort-dropdown')).not.toBeInTheDocument();
    expect(screen.queryByText('view-switcher')).not.toBeInTheDocument();
    expect(screen.queryByText('add-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('batch-dropdown')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
