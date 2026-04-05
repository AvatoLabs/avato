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
}));

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
        confirm: vi.fn(),
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
  canCreateSpaceMemory: () => false,
}));

vi.mock('@/features/ResourceSpaces/useOpenCreateSpaceMemoryCandidateModal', () => ({
  useOpenCreateSpaceMemoryCandidateModal: () => vi.fn(),
}));

vi.mock('@/features/ResourceSpaces/useSpaceItem', () => ({
  useSpaceItem: () => ({
    space: undefined,
  }),
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
      documents: [
        {
          id: 'doc_1',
          spaceId: 'spc_team',
          sourceSetId: null,
          title: 'Audit Spec',
        },
      ],
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
      duplicateDocument: vi.fn(),
      moveContentItem: vi.fn(),
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
      addFilesToSourceSet: vi.fn(),
      removeFilesFromSourceSet: vi.fn(),
      useFetchSourceSetList: () => ({ data: [] }),
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
});
