/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import CodeViewer from './index';

const useTextFileLoaderMock = vi.fn();

vi.mock('@lobehub/ui', () => ({
  Center: ({ children }: any) => <div>{children}</div>,
  Flexbox: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Highlighter: ({ children, language }: any) => (
    <div data-language={language} data-testid="highlighter">
      {children}
    </div>
  ),
}));

vi.mock('@/store/user', () => ({
  useUserStore: vi.fn(() => ({
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

vi.mock('../../hooks/usePageAgentContextFallback', () => ({
  usePageAgentContextFallback: vi.fn(),
}));

vi.mock('@/components/NeuralNetworkLoading', () => ({
  default: () => <div data-testid="loading" />,
}));

vi.mock('../Markdown/components', () => ({
  MermaidDiagramPanel: ({ content }: any) => <div data-testid="mermaid-panel">{content}</div>,
}));

describe('CodeViewer', () => {
  it('renders mermaid files with the mermaid diagram panel', () => {
    useTextFileLoaderMock.mockReturnValue({
      fileData: 'flowchart TD\nA-->B',
      loading: false,
    });

    render(<CodeViewer fileId="file-1" fileName="diagram.mmd" url="/diagram.mmd" />);

    expect(screen.getByTestId('mermaid-panel')).toHaveTextContent('flowchart TD');
  });

  it('detects mermaid syntax in plain text files and upgrades the preview', () => {
    useTextFileLoaderMock.mockReturnValue({
      fileData: 'sequenceDiagram\nAlice->>Bob: Hello',
      loading: false,
    });

    render(<CodeViewer fileId="file-2" fileName="notes.txt" url="/notes.txt" />);

    expect(screen.getByTestId('mermaid-panel')).toHaveTextContent('sequenceDiagram');
  });

  it('keeps normal text files on the code highlighter path', () => {
    useTextFileLoaderMock.mockReturnValue({
      fileData: 'just some notes',
      loading: false,
    });

    render(<CodeViewer fileId="file-3" fileName="notes.txt" url="/notes.txt" />);

    expect(screen.getByTestId('highlighter')).toHaveAttribute('data-language', 'txt');
  });
});
