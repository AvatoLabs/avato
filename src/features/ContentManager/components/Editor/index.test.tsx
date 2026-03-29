/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePageEditorStore } from '@/features/PageEditor/store';

import FileEditor from './index';

interface MockContentManagerState {
  currentViewItemId?: string;
}

interface MockFileStoreState {
  files: Record<
    string,
    {
      name?: string;
      url?: string;
    }
  >;
}

let mockContentManagerState: MockContentManagerState = {
  currentViewItemId: 'docs-1',
};

let mockFileStoreState: MockFileStoreState = {
  files: {
    'docs-1': {
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

vi.mock('@/config/contentIcons', () => ({
  RESOURCE_ENTRY_ICONS: {
    back: 'back',
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
      currentViewItemId: 'docs-1',
    };
    mockFileStoreState = {
      files: {
        'docs-1': {
          name: 'Spec.md',
          url: '/spec.md',
        },
      },
    };
  });

  it('renders the file viewer inside a page-editor store context', () => {
    render(<FileEditor />);

    expect(screen.getByTestId('docs-agent-provider')).toBeInTheDocument();
    expect(screen.getByTestId('docs-agent-provider')).toHaveTextContent('docs-1');
    expect(screen.getByText('Spec.md')).toBeInTheDocument();
    expect(screen.getByTestId('file-content')).toHaveTextContent('docs-1');
  });

  it('recreates the docs-agent context when switching files in preview mode', () => {
    const firstOnBack = vi.fn();
    const secondOnBack = vi.fn();
    const { rerender } = render(<FileEditor onBack={firstOnBack} />);

    mockContentManagerState = {
      currentViewItemId: 'docs-2',
    };
    mockFileStoreState = {
      files: {
        'docs-2': {
          name: 'Roadmap.md',
          url: '/roadmap.md',
        },
      },
    };

    rerender(<FileEditor onBack={secondOnBack} />);

    expect(screen.getByTestId('docs-agent-provider')).toHaveTextContent('docs-2');
    expect(screen.getByText('Roadmap.md')).toBeInTheDocument();
    expect(screen.getByTestId('file-content')).toHaveTextContent('docs-2');
  });
});
