/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDropdownMenu } from './useDropdownMenu';

const mockUseFetchSourceSetList = vi.hoisted(() => vi.fn(() => ({ data: [] })));
const mockResolveWorkspaceSpaceId = vi.hoisted(() =>
  vi.fn(({ spaceId }: { spaceId?: string } = {}) => spaceId ?? 'space-route'),
);

vi.mock('@lobehub/ui', () => ({
  Icon: () => null,
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
      },
      modal: {
        confirm: vi.fn(),
      },
    }),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({
    pathname: '/spaces/space-route/docs',
    search: '',
  }),
  useNavigate: () => vi.fn(),
}));

vi.mock('@/config/contentIcons', () => ({
  RESOURCE_ENTRY_ICONS: {
    sourceSetAdd: 'sourceSetAdd',
    sourceSetRemove: 'sourceSetRemove',
  },
}));

vi.mock('@/const/version', () => ({
  isDesktop: false,
}));

vi.mock('@/features/Electron/titlebar/RecentlyViewed/plugins', () => ({
  pluginRegistry: {
    parseUrl: vi.fn(),
  },
}));

vi.mock('@/features/Pages/usePageSpaceId', () => ({
  usePageSpaceId: () => undefined,
}));

vi.mock('@/helpers/activeWorkspaceSpace', () => ({
  resolveWorkspaceSpaceId: mockResolveWorkspaceSpaceId,
}));

vi.mock('@/store/docs', () => ({
  pageSelectors: {
    getDocumentById: () => () => undefined,
  },
  usePageStore: (selector: any) =>
    selector({
      duplicatePage: vi.fn(),
      internal_dispatchDocuments: vi.fn(),
      removePage: vi.fn(),
    }),
}));

vi.mock('@/store/electron', () => ({
  useElectronStore: (selector: any) => selector({ addTab: vi.fn() }),
}));

vi.mock('@/store/file', () => ({
  useFileStore: (selector: any) =>
    selector({
      moveContentItem: vi.fn(),
    }),
}));

vi.mock('@/store/sourceSet', () => ({
  useSourceSetStore: (selector: any) =>
    selector({
      addFilesToSourceSet: vi.fn(),
      removeFilesFromSourceSet: vi.fn(),
      useFetchSourceSetList: mockUseFetchSourceSetList,
    }),
}));

vi.mock('@/utils/docs', () => ({
  getPageDetailPath: () => '/spaces/space-route/docs/page-1',
  getPageKindFromDocument: () => 'doc',
}));

describe('useDropdownMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers the resolved route workspace when no page or document space is available', () => {
    renderHook(() =>
      useDropdownMenu({
        pageId: 'page-1',
        toggleEditing: vi.fn(),
      }),
    );

    expect(mockResolveWorkspaceSpaceId).toHaveBeenCalledWith({ spaceId: undefined });
    expect(mockUseFetchSourceSetList).toHaveBeenCalledWith('space-route');
  });
});
