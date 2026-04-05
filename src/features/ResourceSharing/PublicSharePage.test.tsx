/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PublicSharePage from './PublicSharePage';

const swrState = vi.hoisted(() => ({
  data: undefined as any,
  error: undefined as any,
  isLoading: false,
}));
const downloadMocks = vi.hoisted(() => ({
  createdLinks: [] as HTMLAnchorElement[],
  createObjectURL: vi.fn(() => 'blob:shared-csv'),
  revokeObjectURL: vi.fn(),
  linkClick: vi.fn(),
}));

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, disabled, href, onClick }: any) => (
    <button data-disabled={disabled} data-href={href} type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Center: ({ children }: any) => <div>{children}</div>,
  Flexbox: ({ as, children }: any) => {
    const Component = as || 'div';
    return <Component>{children}</Component>;
  },
  Input: ({ value }: any) => <input value={value} readOnly />,
  Markdown: ({ children }: any) => <div data-testid="markdown-preview">{children}</div>,
  Text: ({ as, children }: any) => {
    const Component = as || 'span';
    return <Component>{children}</Component>;
  },
}));

vi.mock('@trpc/client', () => ({
  TRPCClientError: class MockTRPCClientError extends Error {
    data?: { code?: string };

    constructor(message: string, data?: { code?: string }) {
      super(message);
      this.data = data;
    }
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { date?: string }) =>
      (
        {
          'publicShare.download': 'Download',
          'publicShare.downloadCsv': 'Download CSV',
          'publicShare.downloadXlsx': 'Download Excel (.xlsx)',
          'publicShare.expiresAt': `Expires ${options?.date}`,
          'publicShare.noPreview': 'No preview',
          'publicShare.notFoundDesc': 'Not found',
          'publicShare.notFoundTitle': 'Missing',
          'publicShare.passwordConfirm': 'Confirm',
          'publicShare.passwordPlaceholder': 'Password',
          'publicShare.passwordSubtitle': 'Enter password',
          'publicShare.passwordTitle': 'Protected share',
          'portal.openInDocEditor': 'Open in Docs',
          'portal.openInFiles': 'Open in Files',
          'shared.kind.document': 'Document',
          'shared.kind.file': 'File',
          'shared.kind.source_set': 'Source Set',
        } as Record<string, string>
      )[key] || key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ token: 'tok_1' }),
}));

vi.mock('swr', () => ({
  default: () => ({
    data: swrState.data,
    error: swrState.error,
    isLoading: swrState.isLoading,
  }),
}));

vi.mock('@/components/404', () => ({
  default: ({ desc, title }: any) => (
    <div>
      {title}
      {desc}
    </div>
  ),
}));

vi.mock('@/components/Branding', () => ({
  ProductLogo: () => <div>Logo</div>,
}));

vi.mock('@/components/Loading/BrandTextLoading', () => ({
  default: () => <div>Loading</div>,
}));

vi.mock('@/libs/markdown/remarkEncodedBreakTag', () => ({
  documentMarkdownRemarkPlugins: [],
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    contentShare: {
      getSharedContentByToken: { query: vi.fn() },
    },
  },
}));

describe('PublicSharePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    swrState.data = undefined;
    swrState.error = undefined;
    swrState.isLoading = false;
    downloadMocks.createdLinks = [];

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: downloadMocks.createObjectURL,
      writable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: downloadMocks.revokeObjectURL,
      writable: true,
    });

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(downloadMocks.linkClick);

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options);

      if (tagName === 'a') {
        downloadMocks.createdLinks.push(element as HTMLAnchorElement);
      }

      return element;
    }) as typeof document.createElement);
  });

  it('renders table documents as a read-only table preview', () => {
    swrState.data = {
      content: '| Name | Status |\n| --- | --- |\n| Launch | Done |',
      expiresAt: new Date('2026-04-04T12:00:00.000Z'),
      kind: 'document',
      localId: 'docs_2',
      metadata: { pageKind: 'table' },
      name: 'Quarterly Table',
      spaceId: 'spc_1',
      title: 'Quarterly Table',
    };

    render(<PublicSharePage />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Launch' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Done' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open in Docs' })).toHaveAttribute(
      'data-href',
      '/spaces/spc_1/docs/table/2',
    );
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download Excel (.xlsx)' })).toBeInTheDocument();
    expect(screen.queryByTestId('markdown-preview')).not.toBeInTheDocument();
  });

  it('downloads shared table documents as csv', () => {
    swrState.data = {
      content: '| Name | Status |\n| --- | --- |\n| Launch | Done |',
      expiresAt: new Date('2026-04-04T12:00:00.000Z'),
      kind: 'document',
      localId: 'docs_2',
      metadata: { pageKind: 'table' },
      name: 'Quarterly Table',
      spaceId: 'spc_1',
      title: 'Quarterly Table',
    };

    render(<PublicSharePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

    expect(downloadMocks.createObjectURL).toHaveBeenCalledTimes(1);
    expect(downloadMocks.linkClick).toHaveBeenCalledTimes(1);
    expect(downloadMocks.revokeObjectURL).toHaveBeenCalledWith('blob:shared-csv');
    expect(downloadMocks.createdLinks.length).toBeGreaterThan(0);
    expect(downloadMocks.createdLinks.at(-1)?.download).toBe('Quarterly Table.csv');
  });

  it('downloads shared table documents as xlsx', () => {
    swrState.data = {
      content: '| Name | Status |\n| --- | --- |\n| Launch | Done |',
      expiresAt: new Date('2026-04-04T12:00:00.000Z'),
      kind: 'document',
      localId: 'docs_2',
      metadata: { pageKind: 'table' },
      name: 'Quarterly Table',
      spaceId: 'spc_1',
      title: 'Quarterly Table',
    };

    render(<PublicSharePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Download Excel (.xlsx)' }));

    expect(downloadMocks.createObjectURL).toHaveBeenCalledTimes(1);
    expect(downloadMocks.linkClick).toHaveBeenCalledTimes(1);
    expect(downloadMocks.revokeObjectURL).toHaveBeenCalledWith('blob:shared-csv');
    expect(downloadMocks.createdLinks.length).toBeGreaterThan(0);
    expect(downloadMocks.createdLinks.at(-1)?.download).toBe('Quarterly Table.xlsx');
  });

  it('keeps regular shared documents on markdown preview', () => {
    swrState.data = {
      content: '# Shared Doc\n\nHello team',
      expiresAt: new Date('2026-04-04T12:00:00.000Z'),
      kind: 'document',
      localId: 'docs_3',
      metadata: { pageKind: 'doc' },
      name: 'Shared Doc',
      spaceId: 'spc_1',
      title: 'Shared Doc',
    };

    render(<PublicSharePage />);

    expect(screen.getByTestId('markdown-preview')).toHaveTextContent('# Shared Doc');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open in Docs' })).toHaveAttribute(
      'data-href',
      '/spaces/spc_1/docs/3',
    );
    expect(screen.queryByRole('button', { name: 'Download CSV' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download Excel (.xlsx)' })).not.toBeInTheDocument();
  });

  it('opens shared source sets in files with source-set scope', () => {
    swrState.data = {
      description: 'Shared research set',
      expiresAt: new Date('2026-04-04T12:00:00.000Z'),
      kind: 'source_set',
      localId: 'ss_1',
      name: 'Research Set',
      spaceId: 'spc_1',
    };

    render(<PublicSharePage />);

    expect(screen.getByRole('button', { name: 'Open in Files' })).toHaveAttribute(
      'data-href',
      '/spaces/spc_1/files?scope=source-set%3Ass_1',
    );
    expect(screen.queryByRole('button', { name: 'Open in Docs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download CSV' })).not.toBeInTheDocument();
  });

  it('opens shared files in the canonical files preview route', () => {
    swrState.data = {
      expiresAt: new Date('2026-04-04T12:00:00.000Z'),
      fileType: 'application/pdf',
      kind: 'file',
      localId: 'file_1',
      name: 'Plan.pdf',
      spaceId: 'spc_1',
    };

    render(<PublicSharePage />);

    expect(screen.getByRole('button', { name: 'Download' })).toHaveAttribute(
      'data-href',
      '/share/f/tok_1',
    );
    expect(screen.getByRole('button', { name: 'Open in Files' })).toHaveAttribute(
      'data-href',
      '/spaces/spc_1/files/item/file_1',
    );
    expect(screen.queryByRole('button', { name: 'Open in Docs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download CSV' })).not.toBeInTheDocument();
  });
});
