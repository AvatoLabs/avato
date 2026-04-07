/**
 * @vitest-environment happy-dom
 */
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useInitFileCheck } from './useInitFileCheck';

const mockNavigate = vi.hoisted(() => vi.fn());

const routeState = vi.hoisted(() => ({
  pathname: '/spaces/spc_1/files',
  routeFileId: undefined as string | undefined,
  searchParams: new URLSearchParams(),
}));

interface MockContentManagerState {
  setCurrentViewItemId: ReturnType<typeof vi.fn>;
  setMode: ReturnType<typeof vi.fn>;
}

interface MockKnowledgeItem {
  fileType?: string;
  name?: string;
  sourceType?: string | null;
}

interface MockDocumentRecord {
  filename?: string | null;
  fileType?: string;
  source?: string | null;
}

const mockContentManagerState = vi.hoisted<MockContentManagerState>(() => ({
  setCurrentViewItemId: vi.fn(),
  setMode: vi.fn(),
}));

const mockKnowledgeItems = vi.hoisted<Record<string, MockKnowledgeItem>>(() => ({}));
const mockDocumentRecords = vi.hoisted<Record<string, MockDocumentRecord>>(() => ({}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({
    pathname: routeState.pathname,
  }),
  useNavigate: () => mockNavigate,
  useParams: () => ({
    fileId: routeState.routeFileId,
  }),
  useSearchParams: () => [routeState.searchParams],
}));

vi.mock('@/features/ResourceSpaces', () => ({
  buildFilesItemPath: vi.fn((basePath: string, fileId: string) => `${basePath}/item/${fileId}`),
}));

vi.mock('@/routes/(main)/content/features/store', () => ({
  useContentManagerStore: vi.fn((selector: (state: MockContentManagerState) => unknown) =>
    selector(mockContentManagerState),
  ),
}));

vi.mock('@/store/file', () => ({
  documentSelectors: {
    getDocumentById: (id?: string) => () => (id ? mockDocumentRecords[id] : undefined),
  },
  useFileStore: vi.fn((selector: any) =>
    selector({
      useFetchKnowledgeItem: (id?: string) =>
        ({ data: id ? mockKnowledgeItems[id] : undefined }) as any,
    }),
  ),
}));

const TestComponent = () => {
  useInitFileCheck();

  return null;
};

describe('useInitFileCheck', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    routeState.pathname = '/spaces/spc_1/files';
    routeState.routeFileId = undefined;
    routeState.searchParams = new URLSearchParams();

    mockContentManagerState.setCurrentViewItemId.mockReset();
    mockContentManagerState.setMode.mockReset();

    Object.keys(mockKnowledgeItems).forEach((key) => {
      delete mockKnowledgeItems[key];
    });
    Object.keys(mockDocumentRecords).forEach((key) => {
      delete mockDocumentRecords[key];
    });
  });

  it('keeps file-backed docs with canonical document ids in doc mode during init', async () => {
    routeState.routeFileId = 'docs_pdf_1';
    mockKnowledgeItems.docs_pdf_1 = {
      fileType: 'application/pdf',
      name: 'Guide.pdf',
      sourceType: 'file',
    };

    render(<TestComponent />);

    await waitFor(() => {
      expect(mockContentManagerState.setCurrentViewItemId).toHaveBeenCalledWith('docs_pdf_1');
      expect(mockContentManagerState.setMode).toHaveBeenCalledWith('doc');
    });
  });

  it('keeps raw pdf files in editor mode during init', async () => {
    routeState.routeFileId = 'file_pdf_1';
    mockKnowledgeItems.file_pdf_1 = {
      fileType: 'application/pdf',
      name: 'Guide.pdf',
      sourceType: 'file',
    };

    render(<TestComponent />);

    await waitFor(() => {
      expect(mockContentManagerState.setCurrentViewItemId).toHaveBeenCalledWith('file_pdf_1');
      expect(mockContentManagerState.setMode).toHaveBeenCalledWith('editor');
    });
  });

  it('migrates legacy files query params to the canonical item route', async () => {
    routeState.searchParams = new URLSearchParams('files=file_legacy_1&view=list');

    render(<TestComponent />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/spaces/spc_1/files/item/file_legacy_1?view=list',
        {
          replace: true,
        },
      );
    });
  });
});
