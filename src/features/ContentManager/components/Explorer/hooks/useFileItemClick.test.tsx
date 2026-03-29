/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useFileItemClick } from './useFileItemClick';

const mockGetDocumentById = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
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

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
}));

vi.mock('@/features/ResourceSpaces', () => ({
  buildContentFolderPath: vi.fn(() => '/content/folder'),
  buildSourceSetFolderPath: vi.fn(() => '/content/source-set/folder'),
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
    mockSetSearchParams.mockReset();
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
    expect(mockSetSearchParams).toHaveBeenCalledWith(expect.any(Function), { replace: true });

    const updateQuery = mockSetSearchParams.mock.calls[0][0] as (
      prev: URLSearchParams,
    ) => URLSearchParams;

    expect(updateQuery(new URLSearchParams()).get('file')).toBe('file_1');
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
    expect(mockSetSearchParams).toHaveBeenCalledWith(expect.any(Function), { replace: true });

    const updateQuery = mockSetSearchParams.mock.calls[0][0] as (
      prev: URLSearchParams,
    ) => URLSearchParams;

    expect(updateQuery(new URLSearchParams()).get('file')).toBe('docs_1');
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

    const updateQuery = mockSetSearchParams.mock.calls[0][0] as (
      prev: URLSearchParams,
    ) => URLSearchParams;

    expect(updateQuery(new URLSearchParams()).get('file')).toBe('file_1');
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

    const updateQuery = mockSetSearchParams.mock.calls[0][0] as (
      prev: URLSearchParams,
    ) => URLSearchParams;

    expect(updateQuery(new URLSearchParams()).get('file')).toBe('file_9');
  });
});
