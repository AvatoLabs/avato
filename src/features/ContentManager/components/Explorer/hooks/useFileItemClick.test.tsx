/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useFileItemClick } from './useFileItemClick';

const mockGetDocumentById = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());

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

vi.mock('react-router-dom', () => ({
  useLocation: () => ({
    pathname: '/spaces/spc_1/files',
    search: '?scope=source-set:ss_1&view=list',
  }),
  useNavigate: () => mockNavigate,
}));

vi.mock('@/features/ResourceSpaces', () => ({
  buildFilesItemPath: vi.fn((basePath: string, fileId: string) => `${basePath}/item/${fileId}`),
  buildFilesFolderPath: vi.fn(() => '/spaces/spc_1/files/folder'),
}));

vi.mock('@/routes/(main)/content/features/store', () => ({
  useContentManagerStore: vi.fn((selector: (state: MockContentManagerState) => unknown) =>
    selector(mockContentManagerState),
  ),
}));

vi.mock('@/services/document', () => ({
  documentService: {
    getDocumentById: mockGetDocumentById,
  },
}));

describe('useFileItemClick', () => {
  beforeEach(() => {
    mockGetDocumentById.mockReset();
    mockNavigate.mockReset();
    mockContentManagerState = {
      setCurrentViewItemId: vi.fn(),
      setMode: vi.fn(),
      spaceId: 'spc_1',
    };
  });

  it('uses fileId for regular file preview routes', async () => {
    const onOpen = vi.fn();
    const { result } = renderHook(() =>
      useFileItemClick({
        fileId: 'file_1',
        id: 'docs_1',
        isFolder: false,
        isPage: false,
        onOpen,
        sourceSetId: 'ss_1',
      }),
    );

    await act(async () => {
      await result.current();
    });

    expect(mockContentManagerState.setCurrentViewItemId).toHaveBeenCalledWith('file_1');
    expect(mockContentManagerState.setMode).toHaveBeenCalledWith('editor');
    expect(onOpen).toHaveBeenCalledWith('file_1');
    expect(mockNavigate).toHaveBeenCalledWith(
      '/spaces/spc_1/files/item/file_1?scope=source-set%3Ass_1&view=list',
      {
        replace: true,
      },
    );
  });

  it('keeps document ids for page editor routes', async () => {
    const { result } = renderHook(() =>
      useFileItemClick({
        id: 'docs_1',
        isFolder: false,
        isPage: true,
        sourceSetId: 'ss_1',
      }),
    );

    await act(async () => {
      await result.current();
    });

    expect(mockContentManagerState.setCurrentViewItemId).toHaveBeenCalledWith('docs_1');
    expect(mockContentManagerState.setMode).toHaveBeenCalledWith('doc');
    expect(mockNavigate).toHaveBeenCalledWith(
      '/spaces/spc_1/files/item/docs_1?scope=source-set%3Ass_1&view=list',
      {
        replace: true,
      },
    );
  });

  it('prefers preview mode for file-backed entries even when the caller marks them as pages', async () => {
    const { result } = renderHook(() =>
      useFileItemClick({
        fileId: 'file_1',
        id: 'docs_1',
        isFolder: false,
        isPage: true,
        sourceSetId: 'ss_1',
      }),
    );

    await act(async () => {
      await result.current();
    });

    expect(mockContentManagerState.setCurrentViewItemId).toHaveBeenCalledWith('file_1');
    expect(mockContentManagerState.setMode).toHaveBeenCalledWith('editor');
    expect(mockNavigate).toHaveBeenCalledWith(
      '/spaces/spc_1/files/item/file_1?scope=source-set%3Ass_1&view=list',
      {
        replace: true,
      },
    );
  });

  it('resolves file-backed documents lazily when fileId is missing', async () => {
    mockGetDocumentById.mockResolvedValue({
      fileId: 'file_9',
      id: 'docs_9',
      sourceType: 'file',
    });

    const { result } = renderHook(() =>
      useFileItemClick({
        id: 'docs_9',
        isFolder: false,
        isPage: true,
        sourceSetId: 'ss_1',
      }),
    );

    await act(async () => {
      await result.current();
    });

    expect(mockGetDocumentById).toHaveBeenCalledWith('docs_9');
    expect(mockContentManagerState.setCurrentViewItemId).toHaveBeenCalledWith('file_9');
    expect(mockContentManagerState.setMode).toHaveBeenCalledWith('editor');
    expect(mockNavigate).toHaveBeenCalledWith(
      '/spaces/spc_1/files/item/file_9?scope=source-set%3Ass_1&view=list',
      {
        replace: true,
      },
    );
  });
});
