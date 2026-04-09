/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMenu } from './useMenu';

const trpcMocks = vi.hoisted(() => ({
  recordContentExport: vi.fn(),
}));

const domMocks = vi.hoisted(() => ({
  createObjectURL: vi.fn(() => 'blob:page-export'),
  createdLinks: [] as HTMLAnchorElement[],
  linkClick: vi.fn(),
  revokeObjectURL: vi.fn(),
}));

const mockMessage = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));
const mockModalConfirm = vi.hoisted(() => vi.fn());
const sourceSetState = vi.hoisted(() => ({
  value: [] as Array<{ id: string; name: string; spaceId?: string }>,
}));
const pageDocumentsState = vi.hoisted(() => ({
  value: [
    {
      id: 'doc_1',
      sourceSetId: null as string | null,
      spaceId: 'spc_team',
      title: 'Audit Spec',
    },
  ],
}));
const addChatContextSelectionMock = vi.hoisted(() => vi.fn());
const openShareModalMock = vi.hoisted(() => vi.fn());
const revealChatContextPanelMock = vi.hoisted(() => vi.fn());
const removeFilesFromSourceSetMock = vi.hoisted(() => vi.fn());
const addFilesToSourceSetMock = vi.hoisted(() => vi.fn());
const moveContentItemMock = vi.hoisted(() => vi.fn());

let mockStoreApiState: any;

vi.mock('@lobechat/const', () => ({
  isDesktop: false,
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

vi.mock('antd-style', () => ({
  cssVar: {
    colorTextTertiary: '#999',
  },
  useResponsive: () => ({
    lg: true,
  }),
}));

vi.mock('dayjs', () => ({
  default: () => ({
    format: () => 'April 5, 2026 at 10:00 AM',
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/config/contentIcons', () => ({
  RESOURCE_ENTRY_ICONS: {
    sourceSetAdd: 'sourceSetAdd',
    sourceSetRemove: 'sourceSetRemove',
  },
}));

vi.mock('@/features/ResourceSpaces/spaceMemoryCapabilities', () => ({
  resolveSpaceMemorySurfaceState: () => ({
    canCreate: false,
    canReview: false,
    contract: {
      canAccessAudit: false,
      canCreate: false,
      canManageRecall: false,
      canViewInbox: false,
      detailViews: ['overview'],
      recallFilters: ['all'],
      sections: ['published', 'playbooks', 'policies'],
    },
    surface: 'viewer',
  }),
}));

vi.mock('@/features/ResourceSpaces/useOpenCreateSpaceMemoryCandidateModal', () => ({
  useOpenCreateSpaceMemoryCandidateModal: () => vi.fn(),
}));

vi.mock('@/features/ResourceSpaces/useSpaceItem', () => ({
  useSpaceItem: () => ({
    space: undefined,
  }),
}));

vi.mock('@/features/ResourceSharing', () => ({
  useResourceShareModal: () => ({
    open: openShareModalMock,
  }),
}));

vi.mock('@/features/ChatInput/utils/revealChatContextPanel', () => ({
  revealChatContextPanel: revealChatContextPanelMock,
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    contentShare: {
      recordContentExport: {
        mutate: trpcMocks.recordContentExport,
      },
    },
  },
}));

vi.mock('@/store/docs', () => ({
  pageSelectors: {
    getDocumentById: (id: string) => (state: any) =>
      state.documents.find((document: any) => document.id === id),
  },
  usePageStore: (selector: any) =>
    selector({
      documents: pageDocumentsState.value,
      internal_dispatchDocuments: vi.fn(),
      refreshDocuments: vi.fn(),
    }),
}));

vi.mock('@/store/document', () => ({
  useDocumentStore: (selector: any) =>
    selector({
      config: {},
    }),
}));

vi.mock('@/store/document/slices/editor', () => ({
  editorSelectors: {
    lastUpdatedTime: () => () => null,
  },
}));

vi.mock('@/store/file', () => ({
  useFileStore: (selector: any) =>
    selector({
      addChatContextSelection: addChatContextSelectionMock,
      duplicateDocument: vi.fn(),
      moveContentItem: moveContentItemMock,
    }),
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: (selector: any) =>
    selector({
      toggleWideScreen: vi.fn(),
    }),
}));

vi.mock('@/store/global/selectors', () => ({
  systemStatusSelectors: {
    wideScreen: () => false,
  },
}));

vi.mock('@/store/sourceSet', () => ({
  useSourceSetStore: (selector: any) =>
    selector({
      addFilesToSourceSet: addFilesToSourceSetMock,
      removeFilesFromSourceSet: removeFilesFromSourceSetMock,
      useFetchSourceSetList: () => ({ data: sourceSetState.value }),
    }),
}));

vi.mock('@/utils/docs', () => ({
  TABLE_PAGE_KIND: 'table',
}));

vi.mock('@/utils/documentExport', () => ({
  XLSX_MIME_TYPE: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  decodeBase64: vi.fn(),
  downloadBlob: vi.fn(),
  normalizeExportFileName: (title: string, ext: string) => `${title}.${ext}`,
}));

vi.mock('../store', () => ({
  usePageEditorStore: (selector: any) =>
    selector({
      documentId: 'doc_1',
      pageKind: 'custom/document',
    }),
  useStoreApi: () => ({
    getState: () => mockStoreApiState,
  }),
}));

describe('useMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sourceSetState.value = [];
    pageDocumentsState.value = [
      {
        id: 'doc_1',
        sourceSetId: null,
        spaceId: 'spc_team',
        title: 'Audit Spec',
      },
    ];
    addFilesToSourceSetMock.mockResolvedValue(undefined);
    moveContentItemMock.mockResolvedValue(undefined);
    removeFilesFromSourceSetMock.mockResolvedValue(undefined);

    trpcMocks.recordContentExport.mockResolvedValue({ success: true });
    mockStoreApiState = {
      editor: {
        getDocument: vi.fn(() => '# Audit Spec'),
      },
      handleCopyLink: vi.fn(),
      handleDelete: vi.fn(),
      onDelete: vi.fn(),
      title: 'Audit Spec',
    };

    domMocks.createdLinks = [];

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: domMocks.createObjectURL,
      writable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: domMocks.revokeObjectURL,
      writable: true,
    });

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(domMocks.linkClick);

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((
      tagName: string,
      options?: ElementCreationOptions,
    ) => {
      const element = originalCreateElement(tagName, options);

      if (tagName === 'a') {
        domMocks.createdLinks.push(element as HTMLAnchorElement);
      }

      return element;
    }) as typeof document.createElement);
  });

  it('records authenticated markdown exports for current documents', async () => {
    const { result } = renderHook(() => useMenu());

    const exportGroup = result.current.menuItems.find((item: any) => item?.key === 'export');
    const markdownAction = exportGroup.children.find(
      (item: any) => item?.key === 'export-markdown',
    );

    await act(async () => {
      await markdownAction.onClick();
    });

    expect(trpcMocks.recordContentExport).toHaveBeenCalledWith({
      format: 'markdown',
      id: 'doc_1',
      kind: 'document',
    });
    expect(domMocks.linkClick).toHaveBeenCalledTimes(1);
    expect(domMocks.createdLinks.at(-1)?.download).toBe('Audit Spec.md');
  });

  it('keeps exporting markdown when export audit fails', async () => {
    trpcMocks.recordContentExport.mockRejectedValueOnce(new Error('audit failed'));

    const { result } = renderHook(() => useMenu());

    const exportGroup = result.current.menuItems.find((item: any) => item?.key === 'export');
    const markdownAction = exportGroup.children.find(
      (item: any) => item?.key === 'export-markdown',
    );

    await act(async () => {
      await markdownAction.onClick();
    });

    expect(trpcMocks.recordContentExport).toHaveBeenCalledTimes(1);
    expect(domMocks.linkClick).toHaveBeenCalledTimes(1);
    expect(mockMessage.success).toHaveBeenCalledWith('docEditor.exportSuccess');
  });

  it('shares the current document through the canonical document identity', () => {
    const { result } = renderHook(() => useMenu());

    const shareAction = result.current.menuItems.find((item: any) => item?.key === 'share');

    expect(shareAction).toBeTruthy();
    shareAction.onClick();

    expect(openShareModalMock).toHaveBeenCalledWith({
      id: 'doc_1',
      kind: 'document',
      name: 'Audit Spec',
    });
  });

  it('adds the current document to chat context from the editor menu', async () => {
    const { result } = renderHook(() => useMenu());

    const action = result.current.menuItems.find((item: any) => item?.key === 'add-to-chat-context');

    expect(action?.label).toBe('actions.addToChatContext');

    await act(async () => {
      await action.onClick();
    });

    expect(addChatContextSelectionMock).toHaveBeenCalledWith({
      content: '# Audit Spec',
      docId: 'doc_1',
      format: 'markdown',
      id: 'document-context-doc_1',
      preview: 'Audit Spec',
      title: 'Audit Spec',
      type: 'text',
    });
    expect(revealChatContextPanelMock).toHaveBeenCalledTimes(1);
    expect(mockMessage.success).toHaveBeenCalledWith('actions.addToChatContextSuccess');
  });

  it('warns when moving a page to a source set that already contains it', async () => {
    pageDocumentsState.value = [
      {
        id: 'doc_1',
        sourceSetId: 'source-set-1',
        spaceId: 'spc_team',
        title: 'Audit Spec',
      },
    ];
    sourceSetState.value = [
      { id: 'source-set-1', name: 'Current', spaceId: 'spc_team' },
      { id: 'source-set-2', name: 'Target', spaceId: 'spc_team' },
    ];
    addFilesToSourceSetMock.mockRejectedValue({ data: { code: 'CONFLICT' } });

    const { result } = renderHook(() => useMenu());

    const moveActionGroup = result.current.menuItems.find(
      (item: any) => item?.key === 'move-to-source-set',
    );
    const moveAction = moveActionGroup.children[0];

    await act(async () => {
      await moveAction.onClick();
    });

    expect(removeFilesFromSourceSetMock).toHaveBeenCalledWith('source-set-1', ['doc_1']);
    expect(moveContentItemMock).toHaveBeenCalledWith('doc_1', null);
    expect(addFilesToSourceSetMock).toHaveBeenCalledWith('source-set-2', ['doc_1']);
    expect(mockMessage.warning).toHaveBeenCalledWith('addToSourceSet.alreadyExists');
  });
});
