/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@lobehub/ui', () => ({
  CodeEditor: vi.fn(({ onValueChange, value }) => (
    <textarea
      data-testid="code-editor"
      value={value}
      onChange={(event) => onValueChange(event.currentTarget.value)}
    />
  )),
  Flexbox: vi.fn(({ children }) => <div>{children}</div>),
  Markdown: vi.fn(({ children }) => <div data-testid="markdown-preview">{children}</div>),
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

vi.mock('@/utils/page', () => ({
  TABLE_PAGE_KIND: 'table',
}));

vi.mock('@/store/document', () => ({
  editorSelectors: {
    content: (id: string) => (state: MockDocumentState) => state.documents[id]?.content ?? '',
    isDocumentLoading: (id: string) => (state: MockDocumentState) => !state.documents[id],
  },
  useDocumentStore: vi.fn((selector: (state: MockDocumentState) => unknown) =>
    selector(mockDocumentState),
  ),
}));

vi.mock('./EditorCanvas', () => ({
  default: vi.fn(() => <div data-testid="rich-editor">Rich editor</div>),
}));

vi.mock('./TableSheet', () => ({
  default: vi.fn(() => <div data-testid="table-sheet" />),
}));

describe('ModeContent', () => {
  beforeEach(() => {
    mockDocumentState = {
      documents: {
        'doc-1': {
          content: '# Hello',
        },
      },
    };
    vi.clearAllMocks();
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
  });

  it('should render a loading skeleton when the document is still loading', () => {
    mockDocumentState = { documents: {} };

    render(<ModeContent documentId="doc-1" pageKind="doc" viewMode="preview" />);

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });
});
