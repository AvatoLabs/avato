/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MasonryView from './index';

const contentManagerState = vi.hoisted(() => ({
  currentFolderId: null as string | null,
  isMasonryReady: false,
  isTransitioning: false,
  selectedFileIds: [] as string[],
  setSelectedFileIds: vi.fn(),
  sourceSetId: undefined as string | undefined,
  spaceId: 'space-1' as string | undefined,
}));

vi.mock('@lobehub/ui', () => ({
  Center: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock('@virtuoso.dev/masonry', () => ({
  VirtuosoMasonry: () => <div>virtuoso-masonry</div>,
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    loadingHeader: 'loadingHeader',
    loadingHeaderEyebrow: 'loadingHeaderEyebrow',
    loadingHeaderSummary: 'loadingHeaderSummary',
    loadingHeaderTitle: 'loadingHeaderTitle',
    loadingMore: 'loadingMore',
    loadingShell: 'loadingShell',
    masonryScroll: 'masonryScroll',
    masonryStage: 'masonryStage',
  }),
  cssVar: {
    colorTextDescription: '#999',
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      (
        {
          'emptyState.files.description': 'Upload your first file.',
          'emptyState.files.title': 'Files',
          loading: options?.defaultValue ?? 'Loading...',
        } as Record<string, string>
      )[key] || key,
  }),
}));

vi.mock('@/routes/(main)/content/features/store', () => ({
  useContentManagerStore: (selector: any) => selector(contentManagerState),
}));

vi.mock('@/store/file', () => ({
  useFileStore: (selector: any) =>
    selector({
      hasMore: false,
      loadMoreResources: vi.fn(),
      pushDockFileList: vi.fn(),
    }),
}));

vi.mock('../useMasonryColumnCount', () => ({
  useMasonryColumnCount: () => 3,
}));

vi.mock('../../EmptyState', () => ({
  default: () => <div>empty-state</div>,
}));

vi.mock('./MasonryItem/MasonryItemWrapper', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('./Skeleton', () => ({
  default: () => <div>masonry-skeleton</div>,
}));

describe('MasonryView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contentManagerState.currentFolderId = null;
    contentManagerState.isMasonryReady = false;
    contentManagerState.isTransitioning = false;
    contentManagerState.selectedFileIds = [];
    contentManagerState.sourceSetId = undefined;
    contentManagerState.spaceId = 'space-1';
  });

  it('renders a dedicated loading state shell before masonry becomes ready', () => {
    render(<MasonryView data={[]} hasResolvedData={false} isLoading />);

    expect(screen.getByTestId('resource-masonry-loading-state')).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(screen.getByText('Upload your first file.')).toBeInTheDocument();
    expect(screen.getByText('masonry-skeleton')).toBeInTheDocument();
  });
});
