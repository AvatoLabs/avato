/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import type { ItemType, MenuItemType } from 'antd/es/menu/interface';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useFileItemDropdown } from './useFileItemDropdown';

const mockCopyToClipboard = vi.hoisted(() => vi.fn());
const mockAddChatContextSelection = vi.hoisted(() => vi.fn());
const mockAddFilesToSourceSet = vi.hoisted(() => vi.fn());
const mockClearTreeFolderCache = vi.hoisted(() => vi.fn());
const mockDeleteContentItem = vi.hoisted(() => vi.fn());
const mockEnsureFileDocument = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const mockOpenCreateSpaceMemoryCandidateModal = vi.hoisted(() => vi.fn());
const mockOpenShareModal = vi.hoisted(() => vi.fn());
const mockPreviewFileContent = vi.hoisted(() => vi.fn());
const mockRevealChatContextPanel = vi.hoisted(() => vi.fn());
const mockGetDocumentById = vi.hoisted(() => vi.fn());
const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockMoveContentItem = vi.hoisted(() => vi.fn());
const mockRefreshFileList = vi.hoisted(() => vi.fn());
const mockRemoveFilesFromSourceSet = vi.hoisted(() => vi.fn());
let mockSpace = {
  id: 'spc_1',
  kind: 'team',
  membershipRole: 'editor',
  name: 'Team Space',
};

interface MockContentManagerState {
  setCurrentViewItemId: ReturnType<typeof vi.fn>;
  setMode: ReturnType<typeof vi.fn>;
  spaceId?: string | null;
}

let mockContentManagerState: MockContentManagerState = {
  setCurrentViewItemId: vi.fn(),
  setMode: vi.fn(),
  spaceId: 'spc_1',
};

const mockMessage = {
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
};

vi.mock('@lobehub/ui', () => ({
  Icon: vi.fn(() => null),
  copyToClipboard: mockCopyToClipboard,
  createRawModal: vi.fn(),
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
    pathname: '/spaces/spc_1/files',
    search: '',
  }),
  useNavigate: () => mockNavigate,
}));

vi.mock('@/config/contentIcons', () => ({
  RESOURCE_ENTRY_ICONS: {
    download: 'download',
    edit: 'edit',
    folderMove: 'folderMove',
    link: 'link',
    share: 'share',
    sourceSet: 'sourceSet',
    sourceSetAdd: 'sourceSetAdd',
    sourceSetRemove: 'sourceSetRemove',
  },
}));

vi.mock('@/features/ContentManager/components/SourceSetTree/treeState', () => ({
  clearTreeFolderCache: mockClearTreeFolderCache,
}));

vi.mock('@/features/ResourceSharing', () => ({
  useResourceShareModal: () => ({
    open: mockOpenShareModal,
  }),
}));

vi.mock('@/features/ChatInput/utils/revealChatContextPanel', () => ({
  revealChatContextPanel: mockRevealChatContextPanel,
}));

vi.mock('@/features/ResourceSpaces', () => ({
  buildFilesItemPath: vi.fn((basePath: string, id: string) => `${basePath}/item/${id}`),
  buildFilesPreviewPath: vi.fn(() => '/spaces/preview'),
}));

vi.mock('@/features/ResourceSpaces/useSpaceItem', () => ({
  useSpaceItem: () => ({
    space: mockSpace,
  }),
}));

vi.mock('@/features/ResourceSpaces/useOpenCreateSpaceMemoryCandidateModal', () => ({
  useOpenCreateSpaceMemoryCandidateModal: () => mockOpenCreateSpaceMemoryCandidateModal,
}));

vi.mock('@/hooks/useAppOrigin', () => ({
  useAppOrigin: () => 'https://app.local',
}));

vi.mock('@/routes/(main)/content/features/store', () => ({
  useContentManagerStore: vi.fn((selector: (state: MockContentManagerState) => unknown) =>
    selector(mockContentManagerState),
  ),
}));

vi.mock('@/services/document', () => ({
  documentService: {
    ensureFileDocument: mockEnsureFileDocument,
    getDocumentById: mockGetDocumentById,
    previewFileContent: mockPreviewFileContent,
  },
}));

vi.mock('@/store/file', () => ({
  useFileStore: vi.fn((selector: any) =>
    selector({
      addChatContextSelection: mockAddChatContextSelection,
      deleteContentItem: mockDeleteContentItem,
      moveContentItem: mockMoveContentItem,
      refreshFileList: mockRefreshFileList,
    }),
  ),
}));

vi.mock('@/store/sourceSet', () => ({
  useSourceSetStore: vi.fn((selector: any) =>
    selector({
      addFilesToSourceSet: mockAddFilesToSourceSet,
      removeFilesFromSourceSet: mockRemoveFilesFromSourceSet,
      useFetchSourceSetList: () => ({ data: [] }),
    }),
  ),
}));

vi.mock('@/utils/client/downloadFile', () => ({
  downloadFile: vi.fn(),
}));

const findAction = (
  items: ItemType[],
  key: string,
): MenuItemType & { onClick: NonNullable<MenuItemType['onClick']> } => {
  const action = items.find(
    (item): item is MenuItemType & { onClick: NonNullable<MenuItemType['onClick']> } =>
      Boolean(
        item &&
        typeof item === 'object' &&
        'key' in item &&
        item.key === key &&
        'onClick' in item &&
        typeof item.onClick === 'function',
      ),
  );

  expect(action).toBeDefined();

  return action!;
};

describe('useFileItemDropdown', () => {
  beforeEach(() => {
    mockCopyToClipboard.mockReset();
    mockAddChatContextSelection.mockReset();
    mockAddFilesToSourceSet.mockReset();
    mockClearTreeFolderCache.mockReset();
    mockDeleteContentItem.mockReset();
    mockEnsureFileDocument.mockReset();
    mockGetDocumentById.mockReset();
    mockModalConfirm.mockReset();
    mockMoveContentItem.mockReset();
    mockNavigate.mockReset();
    mockOpenCreateSpaceMemoryCandidateModal.mockReset();
    mockOpenShareModal.mockReset();
    mockPreviewFileContent.mockReset();
    mockRefreshFileList.mockReset();
    mockRevealChatContextPanel.mockReset();
    mockRemoveFilesFromSourceSet.mockReset();
    mockMessage.error.mockReset();
    mockMessage.success.mockReset();
    mockMessage.warning.mockReset();
    mockContentManagerState = {
      setCurrentViewItemId: vi.fn(),
      setMode: vi.fn(),
      spaceId: 'spc_1',
    };
    mockSpace = {
      id: 'spc_1',
      kind: 'team',
      membershipRole: 'editor',
      name: 'Team Space',
    };
    mockGetDocumentById.mockResolvedValue(undefined);
    mockPreviewFileContent.mockResolvedValue(undefined);
  });

  it('exposes an explicit markdown-to-document action and opens the derived doc', async () => {
    mockEnsureFileDocument.mockResolvedValue({ id: 'docs_converted_1' });

    const { result } = renderHook(() =>
      useFileItemDropdown({
        fileId: 'file_1',
        fileType: 'text/markdown',
        filename: 'Spec.md',
        id: 'file_1',
        url: '/spec.md',
      }),
    );

    const action = findAction(result.current.menuItems(), 'openInDocumentEditor');

    expect(action?.label).toBe('preview.editAsDocument');

    await act(async () => {
      await action.onClick({ domEvent: { stopPropagation: vi.fn() } } as any);
    });

    expect(mockEnsureFileDocument).toHaveBeenCalledWith('file_1');
    expect(mockContentManagerState.setCurrentViewItemId).toHaveBeenCalledWith('docs_converted_1');
    expect(mockContentManagerState.setMode).toHaveBeenCalledWith('doc');

    expect(mockNavigate).toHaveBeenCalledWith('/spaces/spc_1/files/item/docs_converted_1', {
      replace: true,
    });
  });

  it('reuses the existing derived doc id for file-backed resource entries', async () => {
    const { result } = renderHook(() =>
      useFileItemDropdown({
        fileId: 'file_1',
        fileType: 'text/markdown',
        filename: 'Spec.md',
        id: 'docs_existing_1',
        sourceType: 'file',
        url: '/spec.md',
      }),
    );

    const action = findAction(result.current.menuItems(), 'openInDocumentEditor');

    await act(async () => {
      await action.onClick({ domEvent: { stopPropagation: vi.fn() } } as any);
    });

    expect(mockEnsureFileDocument).not.toHaveBeenCalled();
    expect(mockContentManagerState.setCurrentViewItemId).toHaveBeenCalledWith('docs_existing_1');
    expect(mockContentManagerState.setMode).toHaveBeenCalledWith('doc');

    expect(mockNavigate).toHaveBeenCalledWith('/spaces/spc_1/files/item/docs_existing_1', {
      replace: true,
    });
  });

  it('shares file-backed document entries with the canonical document id', async () => {
    const { result } = renderHook(() =>
      useFileItemDropdown({
        fileId: 'file_backing_1',
        fileType: 'text/markdown',
        filename: 'Spec.md',
        id: 'docs_existing_1',
        sourceType: 'file',
        url: '/spec.md',
      }),
    );

    const action = findAction(result.current.menuItems(), 'share');

    await act(async () => {
      await action.onClick({ domEvent: { stopPropagation: vi.fn() } } as any);
    });

    expect(mockOpenShareModal).toHaveBeenCalledWith({
      id: 'docs_existing_1',
      kind: 'document',
      name: 'Spec.md',
    });
  });

  it('keeps raw files on file share targets until they have a backing document', async () => {
    const { result } = renderHook(() =>
      useFileItemDropdown({
        fileId: 'file_raw_1',
        fileType: 'text/markdown',
        filename: 'Draft.md',
        id: 'file_raw_1',
        sourceType: 'file',
        url: '/draft.md',
      }),
    );

    const action = findAction(result.current.menuItems(), 'share');

    await act(async () => {
      await action.onClick({ domEvent: { stopPropagation: vi.fn() } } as any);
    });

    expect(mockOpenShareModal).toHaveBeenCalledWith({
      id: 'file_raw_1',
      kind: 'file',
      name: 'Draft.md',
    });
  });

  it('copies canonical document routes for file-backed document entries', async () => {
    const { result } = renderHook(() =>
      useFileItemDropdown({
        fileId: 'file_backing_1',
        fileType: 'text/markdown',
        filename: 'Spec.md',
        id: 'docs_existing_1',
        sourceSetId: 'sst_1',
        sourceType: 'file',
        url: '/spec.md',
      }),
    );

    const action = findAction(result.current.menuItems(), 'copyUrl');

    await act(async () => {
      await action.onClick({ domEvent: { stopPropagation: vi.fn() } } as any);
    });

    expect(mockCopyToClipboard).toHaveBeenCalledWith('https://app.local/spaces/preview');
    expect(mockMessage.success).toHaveBeenCalledWith('FileManager.actions.copyUrlSuccess');
  });

  it('offers an add-to-space-memory action with source refs', async () => {
    const { result } = renderHook(() =>
      useFileItemDropdown({
        fileId: 'file_1',
        fileType: 'image/png',
        filename: 'Poster.png',
        id: 'file_1',
        sourceSetId: 'sst_1',
        url: '/poster.png',
      }),
    );

    const action = findAction(result.current.menuItems(), 'addToSpaceMemory');

    expect(action?.label).toBe('space.memory.actions.addFromSource');

    await act(async () => {
      await action.onClick({ domEvent: { stopPropagation: vi.fn() } } as any);
    });

    expect(mockOpenCreateSpaceMemoryCandidateModal).toHaveBeenCalledWith({
      defaultTitle: 'Poster.png',
      sourceRefs: [
        { id: 'file_1', kind: 'file', title: 'Poster.png' },
        { id: 'sst_1', kind: 'source_set', title: undefined },
      ],
      spaceId: 'spc_1',
    });
  });

  it('hides add-to-space-memory when the current space cannot create candidate memory', () => {
    mockSpace = {
      id: 'spc_1',
      kind: 'team',
      membershipRole: 'viewer',
      name: 'Team Space',
    };

    const { result } = renderHook(() =>
      useFileItemDropdown({
        fileId: 'file_1',
        fileType: 'image/png',
        filename: 'Poster.png',
        id: 'file_1',
        sourceSetId: 'sst_1',
        url: '/poster.png',
      }),
    );

    const action = result.current
      .menuItems()
      .find((item): item is MenuItemType => Boolean(item && item.key === 'addToSpaceMemory'));

    expect(action).toBeUndefined();
  });

  it('adds canonical document entries to chat context', async () => {
    mockGetDocumentById.mockResolvedValue({
      content: '# Spec',
      id: 'docs_existing_1',
      title: 'Spec',
    });

    const { result } = renderHook(() =>
      useFileItemDropdown({
        fileId: 'file_backing_1',
        fileType: 'text/markdown',
        filename: 'Spec.md',
        id: 'docs_existing_1',
        sourceType: 'file',
        url: '/spec.md',
      }),
    );

    const action = findAction(result.current.menuItems(), 'addToChatContext');

    expect(action?.label).toBe('actions.addToChatContext');

    await act(async () => {
      await action.onClick({ domEvent: { stopPropagation: vi.fn() } } as any);
    });

    expect(mockAddChatContextSelection).toHaveBeenCalledWith({
      content: '# Spec',
      docId: 'docs_existing_1',
      format: 'markdown',
      id: 'document-context-docs_existing_1',
      preview: 'Spec',
      title: 'Spec',
      type: 'text',
    });
    expect(mockRevealChatContextPanel).toHaveBeenCalledTimes(1);
    expect(mockMessage.success).toHaveBeenCalledWith('actions.addToChatContextSuccess');
  });

  it('shows an error when removing an item from a source set fails', async () => {
    mockRemoveFilesFromSourceSet.mockRejectedValue(new Error('remove failed'));

    const { result } = renderHook(() =>
      useFileItemDropdown({
        fileId: 'file_1',
        fileType: 'text/plain',
        filename: 'Spec.txt',
        id: 'file_1',
        sourceSetId: 'sst_1',
        url: '/spec.txt',
      }),
    );

    const action = findAction(result.current.menuItems(), 'removeFromSourceSet');

    await act(async () => {
      await action.onClick({ domEvent: { stopPropagation: vi.fn() } } as any);
    });

    const confirmConfig = mockModalConfirm.mock.calls.at(-1)?.[0];
    expect(confirmConfig).toBeDefined();

    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockRemoveFilesFromSourceSet).toHaveBeenCalledWith('sst_1', ['file_1']);
    expect(mockMessage.error).toHaveBeenCalledWith('FileManager.actions.removeFromCollectionError');
  });

  it('shows an error when deleting an item fails', async () => {
    mockDeleteContentItem.mockRejectedValue(new Error('delete failed'));

    const { result } = renderHook(() =>
      useFileItemDropdown({
        fileId: 'file_1',
        fileType: 'text/plain',
        filename: 'Spec.txt',
        id: 'file_1',
        sourceSetId: 'sst_1',
        url: '/spec.txt',
      }),
    );

    const action = findAction(result.current.menuItems(), 'delete');

    await act(async () => {
      await action.onClick({ domEvent: { stopPropagation: vi.fn() } } as any);
    });

    const confirmConfig = mockModalConfirm.mock.calls.at(-1)?.[0];
    expect(confirmConfig).toBeDefined();

    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockDeleteContentItem).toHaveBeenCalledWith('file_1');
    expect(mockClearTreeFolderCache).not.toHaveBeenCalled();
    expect(mockRefreshFileList).not.toHaveBeenCalled();
    expect(mockMessage.error).toHaveBeenCalledWith('FileManager.actions.deleteError');
  });
});
