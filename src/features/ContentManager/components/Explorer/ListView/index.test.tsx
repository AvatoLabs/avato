/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ListView from './index';

const contentManagerState = vi.hoisted(() => ({
  currentFolderId: null as string | null,
  isTransitioning: false,
  pendingRenameItemId: undefined as string | undefined,
  selectedFileIds: [] as string[],
  setSelectedFileIds: vi.fn(),
  sourceSetId: undefined as string | undefined,
  spaceId: 'space-1' as string | undefined,
}));

vi.mock('@lobehub/ui', () => ({
  Center: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Checkbox: (props: any) => <input type={'checkbox'} {...props} />,
  Flexbox: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    dropZone: 'dropZone',
    dropZoneActive: 'dropZoneActive',
    header: 'header',
    headerItem: 'headerItem',
    scrollContainer: 'scrollContainer',
    stateHeader: 'stateHeader',
    stateHeaderEyebrow: 'stateHeaderEyebrow',
    stateHeaderSummary: 'stateHeaderSummary',
    stateHeaderTitle: 'stateHeaderTitle',
    stateShell: 'stateShell',
  }),
  cssVar: {
    colorBorderSecondary: '#eee',
    colorFillQuaternary: '#f5f5f5',
    colorTextDescription: '#999',
    colorTextSecondary: '#666',
  },
  cx: (...classNames: Array<string | false | null | undefined>) =>
    classNames.filter(Boolean).join(' '),
}));

vi.mock('debug', () => ({
  default: () => () => {},
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      (
        {
          'emptyState.files.description': 'Upload your first file.',
          'FileManager.title.title': 'Title',
          loading: options?.defaultValue ?? 'Loading...',
        } as Record<string, string>
      )[key] || key,
  }),
}));

vi.mock('@/routes/(main)/content/features/DndContextWrapper', () => ({
  useDragActive: () => false,
}));

vi.mock('@/routes/(main)/content/features/hooks/useFolderPath', () => ({
  useFolderPath: () => ({
    currentFolderSlug: null,
  }),
}));

vi.mock('@/routes/(main)/content/features/store', () => ({
  useContentManagerFetchContentFolderBreadcrumb: () => ({
    data: undefined,
  }),
  useContentManagerStore: (selector: any) => selector(contentManagerState),
}));

vi.mock('@/store/file', () => ({
  useFileStore: (selector?: any) => {
    const state = {
      hasMore: false,
      loadMoreResources: vi.fn(),
      pushDockFileList: vi.fn(),
    };

    return selector ? selector(state) : state;
  },
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: (selector: any) =>
    selector({
      status: {
        contentManagerColumnWidths: {
          date: 160,
          name: 320,
          size: 120,
        },
      },
      updateContentManagerColumnWidth: vi.fn(),
    }),
}));

vi.mock('@/store/global/initialState', () => ({
  INITIAL_STATUS: {
    contentManagerColumnWidths: {
      date: 160,
      name: 320,
      size: 120,
    },
  },
}));

vi.mock('../../EmptyState', () => ({
  default: () => <div>empty-state</div>,
}));

vi.mock('./ColumnResizeHandle', () => ({
  default: () => <div>resize-handle</div>,
}));

vi.mock('./ListItem', () => ({
  default: () => <div>list-item</div>,
}));

vi.mock('./Skeleton', () => ({
  default: () => <div>list-skeleton</div>,
}));

describe('ListView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contentManagerState.currentFolderId = null;
    contentManagerState.isTransitioning = false;
    contentManagerState.pendingRenameItemId = undefined;
    contentManagerState.selectedFileIds = [];
    contentManagerState.sourceSetId = undefined;
    contentManagerState.spaceId = 'space-1';
  });

  it('renders a dedicated loading state shell before list data resolves', () => {
    render(<ListView data={[]} hasResolvedData={false} isLoading />);

    expect(screen.getByTestId('resource-list-loading-state')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Upload your first file.')).toBeInTheDocument();
    expect(screen.getByText('list-skeleton')).toBeInTheDocument();
  });
});
