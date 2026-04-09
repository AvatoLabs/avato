/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FilePreview from './FilePreview';

const fileRecord = vi.hoisted<Record<string, any>>(() => ({
  'doc-1': {
    chunkCount: null,
    chunkingError: null,
    createdAt: new Date('2026-04-06T00:00:00.000Z'),
    embeddingError: null,
    fileType: 'text/markdown',
    finishEmbedding: false,
    id: 'doc-1',
    name: 'Architecture Notes.md',
    size: 2048,
    sourceType: 'file',
    updatedAt: new Date('2026-04-06T00:00:00.000Z'),
    url: '/files/doc-1',
  },
  'img-1': {
    chunkCount: null,
    chunkingError: null,
    createdAt: new Date('2026-04-06T00:00:00.000Z'),
    embeddingError: null,
    fileType: 'image/png',
    finishEmbedding: false,
    id: 'img-1',
    name: 'Moodboard.png',
    size: 4096,
    sourceType: 'file',
    updatedAt: new Date('2026-04-06T00:00:00.000Z'),
    url: '/files/img-1',
  },
}));

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    page: 'page',
    pageGlow: 'pageGlow',
    shell: 'shell',
    stage: 'stage',
    stageHeader: 'stageHeader',
    stageHeaderMeta: 'stageHeaderMeta',
    stageHeaderMetaRow: 'stageHeaderMetaRow',
    stageHeaderMetaTag: 'stageHeaderMetaTag',
    stageHeaderName: 'stageHeaderName',
    stageHeaderSubtitle: 'stageHeaderSubtitle',
    viewerShell: 'viewerShell',
    viewerShell_document: 'viewerShell_document',
    viewerShell_visual: 'viewerShell_visual',
    viewerFrame: 'viewerFrame',
    viewerFrame_document: 'viewerFrame_document',
    viewerFrame_visual: 'viewerFrame_visual',
  }),
  cx: (...classNames: Array<string | false | null | undefined>) =>
    classNames.filter(Boolean).join(' '),
}));

vi.mock('@/features/FileViewer', () => ({
  default: ({ id }: { id: string }) => <div>{`viewer:${id}`}</div>,
}));

vi.mock('@/store/file', () => ({
  fileManagerSelectors: {
    getFileById: (id: string) => () => fileRecord[id],
  },
  useFileStore: (selector: any) => selector({}),
}));

vi.mock('@/utils/format', () => ({
  formatSize: (size: number) => `${(size / 1024).toFixed(1)} KB`,
}));

describe('FilePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a document preview stage with file metadata', () => {
    render(<FilePreview id={'doc-1'} />);

    expect(screen.getByTestId('modal-file-preview')).toBeInTheDocument();
    expect(screen.getByText('Architecture Notes.md')).toBeInTheDocument();
    expect(screen.getByText('MD · 2.0 KB')).toBeInTheDocument();
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByText('Document Surface')).toBeInTheDocument();
    expect(screen.getByText('viewer:doc-1')).toBeInTheDocument();
    expect(screen.getByTestId('modal-file-preview-stage')).toHaveAttribute(
      'data-preview-surface',
      'document',
    );
  });

  it('uses the visual stage for media previews', () => {
    render(<FilePreview id={'img-1'} />);

    expect(screen.getByText('Visual Surface')).toBeInTheDocument();
    expect(screen.getByTestId('modal-file-preview-stage')).toHaveAttribute(
      'data-preview-surface',
      'visual',
    );
  });

  it('returns nothing when the file is missing', () => {
    const { container } = render(<FilePreview id={'missing'} />);

    expect(container).toBeEmptyDOMElement();
  });
});
