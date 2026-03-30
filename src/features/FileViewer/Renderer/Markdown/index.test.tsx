/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import MarkdownViewer from './index';

const useTextFileLoaderMock = vi.fn();
const markdownMock = vi.fn();

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ title }: any) => <button title={title} type="button" />,
  Alert: ({ message, title }: any) => (
    <div data-testid="alert">
      <span>{title}</span>
      <span>{message}</span>
    </div>
  ),
  Center: ({ children }: any) => <div data-testid="center">{children}</div>,
  CopyButton: () => <button type="button" />,
  Flexbox: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Highlighter: ({ children }: any) => <div>{children}</div>,
  Markdown: (props: any) => {
    markdownMock(props);

    return <div data-testid="markdown">{props.children}</div>;
  },
  SyntaxMermaid: ({ children }: any) => <div>{children}</div>,
  Tag: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'common:unknownError': 'Unknown error',
        'preview.markdownLoadError': 'Failed to load Markdown preview',
      })[key] || key,
  }),
}));

vi.mock('@/store/user', () => ({
  useUserStore: vi.fn(() => ({
    fontSize: 14,
    highlighterTheme: 'github-dark',
    mermaidTheme: 'neutral',
  })),
}));

vi.mock('@/store/user/selectors', () => ({
  userGeneralSettingsSelectors: {
    config: {},
  },
}));

vi.mock('../../hooks/useTextFileLoader', () => ({
  useTextFileLoader: (...args: any[]) => useTextFileLoaderMock(...args),
}));

vi.mock('../../hooks/useDocsAgentContextFallback', () => ({
  useDocsAgentContextFallback: vi.fn(),
}));

vi.mock('@/components/Loading/CircleLoading', () => ({
  default: () => <div data-testid="loading" />,
}));

describe('MarkdownViewer', () => {
  it('renders markdown content when the file loads successfully', () => {
    markdownMock.mockClear();
    useTextFileLoaderMock.mockReturnValue({
      error: null,
      fileData: '# Hello',
      loading: false,
    });

    render(<MarkdownViewer fileId="file-1" url="/test.md" />);

    expect(screen.getByTestId('markdown')).toHaveTextContent('# Hello');
    expect(markdownMock).toHaveBeenCalledWith(
      expect.objectContaining({
        components: expect.objectContaining({
          pre: expect.any(Function),
          table: expect.any(Function),
        }),
        style: expect.objectContaining({ overflow: 'visible' }),
      }),
    );
  });

  it('renders an error state when markdown loading fails', () => {
    useTextFileLoaderMock.mockReturnValue({
      error: new Error('Request failed'),
      fileData: null,
      loading: false,
    });

    render(<MarkdownViewer fileId="file-1" url="/test.md" />);

    expect(screen.getByTestId('alert')).toHaveTextContent('Failed to load Markdown preview');
    expect(screen.getByTestId('alert')).toHaveTextContent('Request failed');
  });
});
