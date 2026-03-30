/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useFileItemDropdown } from './useFileItemDropdown';

const mockEnsureFileDocument = vi.hoisted(() => vi.fn());
const mockSetSearchParams = vi.hoisted(() => vi.fn());

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
  copyToClipboard: vi.fn(),
  createRawModal: vi.fn(),
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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
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

vi.mock('@/features/ContentManager/components/SourceSetTree', () => ({
  clearTreeFolderCache: vi.fn(),
}));

vi.mock('@/features/ResourceSharing', () => ({
  useResourceShareModal: () => ({
    open: vi.fn(),
  }),
}));

vi.mock('@/features/ResourceSpaces', () => ({
  buildContentPreviewPath: vi.fn(() => '/content/preview'),
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
    getDocumentById: vi.fn(),
  },
}));

vi.mock('@/store/file', () => ({
  useFileStore: vi.fn((selector: any) =>
    selector({
      deleteContentItem: vi.fn(),
      moveContentItem: vi.fn(),
      refreshFileList: vi.fn(),
    }),
  ),
}));

vi.mock('@/store/sourceSet', () => ({
  useSourceSetStore: vi.fn((selector: any) =>
    selector({
      addFilesToSourceSet: vi.fn(),
      removeFilesFromSourceSet: vi.fn(),
      useFetchSourceSetList: () => ({ data: [] }),
    }),
  ),
}));

vi.mock('@/utils/client/downloadFile', () => ({
  downloadFile: vi.fn(),
}));

describe('useFileItemDropdown', () => {
  beforeEach(() => {
    mockEnsureFileDocument.mockReset();
    mockSetSearchParams.mockReset();
    mockMessage.error.mockReset();
    mockMessage.success.mockReset();
    mockMessage.warning.mockReset();
    mockContentManagerState = {
      setCurrentViewItemId: vi.fn(),
      setMode: vi.fn(),
      spaceId: 'spc_1',
    };
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

    const action = result.current
      .menuItems()
      .find((item: any) => item?.key === 'openInDocumentEditor');

    expect(action?.label).toBe('preview.editAsDocument');

    await act(async () => {
      await action.onClick({ domEvent: { stopPropagation: vi.fn() } });
    });

    expect(mockEnsureFileDocument).toHaveBeenCalledWith('file_1');
    expect(mockContentManagerState.setCurrentViewItemId).toHaveBeenCalledWith('docs_converted_1');
    expect(mockContentManagerState.setMode).toHaveBeenCalledWith('doc');

    const updateQuery = mockSetSearchParams.mock.calls[0][0] as (
      prev: URLSearchParams,
    ) => URLSearchParams;

    expect(updateQuery(new URLSearchParams()).get('file')).toBe('docs_converted_1');
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

    const action = result.current
      .menuItems()
      .find((item: any) => item?.key === 'openInDocumentEditor');

    await act(async () => {
      await action.onClick({ domEvent: { stopPropagation: vi.fn() } });
    });

    expect(mockEnsureFileDocument).not.toHaveBeenCalled();
    expect(mockContentManagerState.setCurrentViewItemId).toHaveBeenCalledWith('docs_existing_1');
    expect(mockContentManagerState.setMode).toHaveBeenCalledWith('doc');

    const updateQuery = mockSetSearchParams.mock.calls[0][0] as (
      prev: URLSearchParams,
    ) => URLSearchParams;

    expect(updateQuery(new URLSearchParams()).get('file')).toBe('docs_existing_1');
  });
});
