/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { documentMarkdownRemarkPlugins } from '@/libs/markdown/remarkEncodedBreakTag';

import ModeContent from './ModeContent';

interface MockDocumentState {
  documents: Record<string, { content: string }>;
}

let mockDocumentState: MockDocumentState = {
  documents: {
    'doc-1': {
      content: '# Hello',
    },
  },
};
const { documentStoreApi, markdownMock, tableSheetMock, useDocumentStoreMock } = vi.hoisted(() => ({
  documentStoreApi: {
    handleContentChange: vi.fn(),
    syncExternalDocumentContent: vi.fn(),
  },
  markdownMock: vi.fn(({ children }: any) => <div data-testid="markdown-preview">{children}</div>),
  tableSheetMock: vi.fn((props: any) => {
    void props;
    return <div data-testid="table-sheet" />;
  }),
  useDocumentStoreMock: Object.assign(
    vi.fn((selector: (state: MockDocumentState) => unknown) => selector(mockDocumentState)),
    {
      getState: vi.fn(),
    },
  ),
}));

vi.mock('@lobehub/ui', () => ({
  CodeEditor: vi.fn(({ onValueChange, value }) => (
    <textarea
      data-testid="code-editor"
      value={value}
      onChange={(event) => onValueChange(event.currentTarget.value)}
    />
  )),
  Flexbox: vi.fn(({ children }) => <div>{children}</div>),
  Markdown: markdownMock,
  Skeleton: vi.fn(() => <div data-testid="skeleton" />),
}));

vi.mock('antd-style', () => ({
  cssVar: {
    borderRadiusLG: '8px',
    colorBorderSecondary: '#d9d9d9',
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/utils/docs', () => ({
  TABLE_PAGE_KIND: 'table',
}));

vi.mock('@/store/document', () => ({
  editorSelectors: {
    content: (id: string) => (state: MockDocumentState) => state.documents[id]?.content ?? '',
    isDocumentLoading: (id: string) => (state: MockDocumentState) => !state.documents[id],
  },
  useDocumentStore: useDocumentStoreMock,
}));

vi.mock('./EditorCanvas', () => ({
  default: vi.fn(() => <div data-testid="rich-editor">Rich editor</div>),
}));

vi.mock('./TableSheet', () => ({
  default: tableSheetMock,
}));

describe('ModeContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocumentState = {
      documents: {
        'doc-1': {
          content: '# Hello',
        },
      },
    };
    useDocumentStoreMock.mockImplementation((selector: (state: MockDocumentState) => unknown) =>
      selector(mockDocumentState),
    );
    useDocumentStoreMock.getState.mockReturnValue(documentStoreApi);
  });

  it('should render markdown source mode with store content', () => {
    render(<ModeContent documentId="doc-1" pageKind="doc" viewMode="markdown" />);

    expect(screen.getByTestId('code-editor')).toHaveValue('# Hello');
    expect(screen.getByTestId('rich-editor')).toBeInTheDocument();
  });

  it('should sync markdown source changes to the editor instance', () => {
    const editor = {
      setDocument: vi.fn(),
    } as any;

    render(<ModeContent documentId="doc-1" editor={editor} pageKind="doc" viewMode="markdown" />);

    fireEvent.change(screen.getByTestId('code-editor'), {
      target: { value: '# Updated' },
    });

    expect(editor.setDocument).toHaveBeenCalledWith('markdown', '# Updated', { keepId: true });
    expect(screen.getByTestId('code-editor')).toHaveValue('# Updated');
  });

  it('should prefer the current editor markdown when entering preview mode', () => {
    const editor = {
      getDocument: vi.fn(() => '# From editor'),
    } as any;

    const { rerender } = render(
      <ModeContent documentId="doc-1" editor={editor} pageKind="doc" viewMode="rich" />,
    );

    rerender(<ModeContent documentId="doc-1" editor={editor} pageKind="doc" viewMode="preview" />);

    expect(screen.getByTestId('markdown-preview')).toHaveTextContent('# From editor');
    expect(markdownMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        remarkPluginsAhead: [...documentMarkdownRemarkPlugins],
      }),
      undefined,
    );
  });

  it('should render a loading skeleton when the document is still loading', () => {
    mockDocumentState = { documents: {} };

    render(<ModeContent documentId="doc-1" pageKind="doc" viewMode="preview" />);

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('falls back to syncing the document store when table markdown source is unavailable', () => {
    const editor = {
      setDocument: vi.fn(() => {
        throw new Error('DataSource for type "markdown" is not registered.');
      }),
    } as any;

    render(<ModeContent documentId="doc-1" editor={editor} pageKind="table" viewMode="rich" />);

    const onMarkdownCommit = tableSheetMock.mock.calls.at(-1)?.[0]?.onMarkdownCommit as
      | ((value: string) => void)
      | undefined;

    expect(onMarkdownCommit).toEqual(expect.any(Function));
    onMarkdownCommit?.('| Name |\n| --- |\n| RealBug |');

    expect(documentStoreApi.syncExternalDocumentContent).toHaveBeenCalledWith('doc-1', {
      content: '| Name |\n| --- |\n| RealBug |',
    });
  });
});
