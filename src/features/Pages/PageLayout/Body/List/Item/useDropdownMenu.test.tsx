/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDropdownMenu } from './useDropdownMenu';

const mockUseFetchSourceSetList = vi.hoisted(() => vi.fn(() => ({ data: [] })));
const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockRemoveFilesFromSourceSet = vi.hoisted(() => vi.fn());
const mockMessage = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));
const mockResolveWorkspaceSpaceId = vi.hoisted(() =>
  vi.fn(({ spaceId }: { spaceId?: string } = {}) => spaceId ?? 'space-route'),
);
const pageState = vi.hoisted(() => ({
  document: undefined as
    | {
        id: string;
        spaceId?: string;
        sourceSetId?: string | null;
      }
    | undefined,
}));

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
    getDocumentById: () => () => pageState.document,
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
      removeFilesFromSourceSet: mockRemoveFilesFromSourceSet,
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
    pageState.document = undefined;
    mockUseFetchSourceSetList.mockReturnValue({ data: [] });
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

  it('shows an error when removing a page from a source set fails', async () => {
    const error = new Error('remove failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    pageState.document = {
      id: 'page-1',
      sourceSetId: 'source-set-1',
      spaceId: 'space-route',
    };
    mockRemoveFilesFromSourceSet.mockRejectedValue(error);

    const { result } = renderHook(() =>
      useDropdownMenu({
        pageId: 'page-1',
        toggleEditing: vi.fn(),
      }),
    );

    const items = result.current();
    const removeAction = items.find((item: any) => item?.key === 'remove-from-source-set') as any;

    removeAction?.onClick();

    const confirmConfig = mockModalConfirm.mock.calls[0][0];

    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockRemoveFilesFromSourceSet).toHaveBeenCalledWith('source-set-1', ['page-1']);
    expect(mockMessage.error).toHaveBeenCalledWith('FileManager.actions.removeFromCollectionError');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to remove page from source set:', error);

    consoleErrorSpy.mockRestore();
  });
});
