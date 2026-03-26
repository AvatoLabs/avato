/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type FileListItem } from '@/types/files';

import FileViewer from './index';

vi.mock('./Renderer/Code', () => ({
  default: vi.fn(() => <div data-testid="code-viewer" />),
}));

vi.mock('./Renderer/Excel', () => ({
  default: vi.fn(() => <div data-testid="excel-viewer" />),
}));

vi.mock('./Renderer/Image', () => ({
  default: vi.fn(() => <div data-testid="image-viewer" />),
}));

vi.mock('./Renderer/Markdown', () => ({
  default: vi.fn(() => <div data-testid="markdown-viewer" />),
}));

vi.mock('./Renderer/PDF', () => ({
  default: vi.fn(() => <div data-testid="pdf-viewer" />),
}));

vi.mock('./Renderer/Video', () => ({
  default: vi.fn(() => <div data-testid="video-viewer" />),
}));

vi.mock('./NotSupport', () => ({
  default: vi.fn(() => <div data-testid="not-support" />),
}));

const createFile = (overrides: Partial<FileListItem>): FileListItem => ({
  chunkCount: null,
  chunkingError: null,
  createdAt: new Date('2026-03-26T00:00:00.000Z'),
  embeddingError: null,
  fileType: 'text/plain',
  finishEmbedding: false,
  id: 'file-1',
  name: 'README.md',
  size: 128,
  sourceType: 'file',
  updatedAt: new Date('2026-03-26T00:00:00.000Z'),
  url: '/readme.md',
  ...overrides,
});

describe('FileViewer', () => {
  it('renders markdown files with the markdown viewer', () => {
    render(<FileViewer {...createFile({})} />);

    expect(screen.getByTestId('markdown-viewer')).toBeInTheDocument();
  });

  it('renders .markdown files with the markdown viewer', () => {
    render(
      <FileViewer
        {...createFile({
          fileType: 'application/octet-stream',
          id: 'file-2',
          name: 'guide.markdown',
          url: '/guide',
        })}
      />,
    );

    expect(screen.getByTestId('markdown-viewer')).toBeInTheDocument();
  });

  it('keeps mdx files on the code viewer path', () => {
    render(<FileViewer {...createFile({ id: 'file-3', name: 'docs.mdx', url: '/docs.mdx' })} />);

    expect(screen.getByTestId('code-viewer')).toBeInTheDocument();
  });

  it('renders xlsx files with the local excel viewer', () => {
    render(
      <FileViewer
        {...createFile({
          fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          id: 'file-4',
          name: 'report.xlsx',
          url: '/report.xlsx',
        })}
      />,
    );

    expect(screen.getByTestId('excel-viewer')).toBeInTheDocument();
  });

  it('falls back to download-only preview for docx files', () => {
    render(
      <FileViewer
        {...createFile({
          fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          id: 'file-5',
          name: 'proposal.docx',
          url: '/proposal.docx',
        })}
      />,
    );

    expect(screen.getByTestId('not-support')).toBeInTheDocument();
  });
});
