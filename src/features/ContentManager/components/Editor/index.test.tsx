/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePageEditorStore } from '@/features/PageEditor/store';

import FileEditor from './index';

interface MockContentManagerState {
  currentViewItemId?: string;
  setCurrentViewItemId: ReturnType<typeof vi.fn>;
  setMode: ReturnType<typeof vi.fn>;
}

interface MockFileStoreState {
  files: Record<
    string,
    {
      fileType?: string;
      name?: string;
      url?: string;
    }
  >;
}

const mockSetSearchParams = vi.hoisted(() => vi.fn());
const mockEnsureFileDocument = vi.hoisted(() => vi.fn());

let mockContentManagerState: MockContentManagerState = {
  currentViewItemId: 'file-1',
  setCurrentViewItemId: vi.fn(),
  setMode: vi.fn(),
};

let mockFileStoreState: MockFileStoreState = {
  files: {
    'file-1': {
      fileType: 'text/plain',
      name: 'Spec.md',
      url: '/spec.md',
    },
  },
};

vi.mock('@lobehub/ui', () => ({
  ActionIcon: vi.fn(({ onClick, title }) => (
    <button title={title} type="button" onClick={onClick} />
  )),
  Flexbox: vi.fn(({ children }) => <div>{children}</div>),
}));

vi.mock('antd', () => ({
  Modal: vi.fn(({ children, open }) => (open ? <div>{children}</div> : null)),
}));

vi.mock('antd-style', () => ({
  cssVar: {
    colorBorderSecondary: '#d9d9d9',
  },
  useTheme: () => ({
    colorText: '#000',
  }),
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
    back: 'back',
    edit: 'edit',
    download: 'download',
    info: 'info',
  },
}));

vi.mock('@/features/NavHeader', () => ({
  default: vi.fn(({ left, right }) => (
    <div>
      <div>{left}</div>
      <div>{right}</div>
    </div>
  )),
}));

vi.mock('@/features/PageEditor/DocsAgentProvider', () => ({
  DocsAgentProvider: vi.fn(({ children }) => {
    const documentId = usePageEditorStore((s) => s.documentId);

    return (
      <div data-testid="docs-agent-provider">
        {documentId}
        {children}
      </div>
    );
  }),
}));

vi.mock('@/routes/(main)/content/features/FileDetail', () => ({
  default: vi.fn(() => <div data-testid="file-detail" />),
}));

vi.mock('@/routes/(main)/content/features/store', () => ({
  useContentManagerStore: vi.fn((selector: (state: MockContentManagerState) => unknown) =>
    selector(mockContentManagerState),
  ),
}));

vi.mock('@/services/document', () => ({
  documentService: {
    ensureFileDocument: mockEnsureFileDocument,
  },
}));

vi.mock('@/store/file', () => ({
  fileManagerSelectors: {
    getFileById: (id?: string) => (state: MockFileStoreState) => (id ? state.files[id] : undefined),
  },
  useFileStore: vi.fn((selector: (state: MockFileStoreState) => unknown) =>
    selector(mockFileStoreState),
  ),
}));

vi.mock('@/utils/client/downloadFile', () => ({
  downloadFile: vi.fn(),
}));

vi.mock('./FileContent', () => ({
  default: vi.fn(({ fileId }: { fileId?: string }) => (
    <div data-testid="file-content">{fileId}</div>
  )),
}));

describe('FileEditor', () => {
  beforeEach(() => {
    mockContentManagerState = {
      currentViewItemId: 'file-1',
      setCurrentViewItemId: vi.fn(),
      setMode: vi.fn(),
    };
    mockFileStoreState = {
      files: {
        'file-1': {
          fileType: 'text/plain',
          name: 'Spec.md',
          url: '/spec.md',
        },
      },
    };
    mockEnsureFileDocument.mockReset();
    mockSetSearchParams.mockReset();
  });

  it('renders the file viewer inside a page-editor store context', () => {
    render(<FileEditor />);

    expect(screen.getByTestId('docs-agent-provider')).toBeInTheDocument();
    expect(screen.getByTestId('docs-agent-provider')).toHaveTextContent('file-1');
    expect(screen.getByText('Spec.md')).toBeInTheDocument();
    expect(screen.getByTestId('file-content')).toHaveTextContent('file-1');
  });

  it('recreates the docs-agent context when switching files in preview mode', () => {
    const firstOnBack = vi.fn();
    const secondOnBack = vi.fn();
    const { rerender } = render(<FileEditor onBack={firstOnBack} />);

    mockContentManagerState = {
      currentViewItemId: 'file-2',
      setCurrentViewItemId: vi.fn(),
      setMode: vi.fn(),
    };
    mockFileStoreState = {
      files: {
        'file-2': {
          fileType: 'text/plain',
          name: 'Roadmap.md',
          url: '/roadmap.md',
        },
      },
    };

    rerender(<FileEditor onBack={secondOnBack} />);

    expect(screen.getByTestId('docs-agent-provider')).toHaveTextContent('file-2');
    expect(screen.getByText('Roadmap.md')).toBeInTheDocument();
    expect(screen.getByTestId('file-content')).toHaveTextContent('file-2');
  });

  it('switches to doc mode with a docs id when editing markdown as a document', async () => {
    mockEnsureFileDocument.mockResolvedValue({ id: 'docs-converted-1' });

    render(<FileEditor />);

    fireEvent.click(screen.getByTitle('preview.editAsDocument'));

    await waitFor(() => {
      expect(mockEnsureFileDocument).toHaveBeenCalledWith('file-1');
    });

    expect(mockContentManagerState.setCurrentViewItemId).toHaveBeenCalledWith('docs-converted-1');
    expect(mockContentManagerState.setMode).toHaveBeenCalledWith('doc');
    expect(mockSetSearchParams).toHaveBeenCalledWith(expect.any(Function), { replace: true });

    const updateQuery = mockSetSearchParams.mock.calls[0][0] as (
      prev: URLSearchParams,
    ) => URLSearchParams;

    expect(updateQuery(new URLSearchParams()).get('file')).toBe('docs-converted-1');
  });
});
