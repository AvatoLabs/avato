/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TRPCClientError } from '@trpc/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { formatDateTime } from '@/utils/format';

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
const trpcMocks = vi.hoisted(() => ({
  recordSharedContentExport: vi.fn(),
}));

vi.mock('@lobehub/ui', () => ({
  Block: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Button: ({ children, disabled, href, onClick }: any) => (
    <button
      data-disabled={disabled}
      data-href={href}
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  ),
  Center: ({ children }: any) => <div>{children}</div>,
  DropdownMenu: ({ children, items }: any) => (
    <div>
      {children}
      <div>
        {items.map((item: any) => (
          <button key={item.key} type="button" onClick={() => item.onClick?.()}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  ),
  Flexbox: ({ as, children, horizontal: _horizontal, onSubmit, ...props }: any) => {
    const Component = as || 'div';
    return (
      <Component onSubmit={onSubmit} {...props}>
        {children}
      </Component>
    );
  },
  Input: ({ onChange, onKeyDown, value, ...props }: any) => (
    <input value={value} onChange={onChange} onKeyDown={onKeyDown} {...props} />
  ),
  Markdown: ({ children }: any) => <div data-testid="markdown-preview">{children}</div>,
  Tag: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Text: ({ as, children, ...props }: any) => {
    const Component = as || 'span';
    return <Component {...props}>{children}</Component>;
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
        ({
          'publicShare.download': 'Download',
          'publicShare.downloadCsv': 'Download CSV',
          'publicShare.downloadXlsx': 'Download Excel (.xlsx)',
          'publicShare.exportActions': 'Export',
          'publicShare.moreActions': 'More actions',
          'publicShare.expiresAt': `Expires ${options?.date}`,
          'publicShare.noPreview': 'No preview',
          'publicShare.notFoundDesc': 'Not found',
          'publicShare.notFoundTitle': 'Missing',
          'publicShare.passwordConfirm': 'Confirm',
          'publicShare.passwordError.invalid': 'That password did not work. Try again.',
          'publicShare.passwordError.required': 'Enter the password to continue.',
          'publicShare.passwordLabel': 'Password',
          'publicShare.passwordPlaceholder': 'Password',
          'publicShare.passwordSubtitle': 'Enter password',
          'publicShare.passwordTitle': 'Protected share',
          'publicShare.previewReadonly': 'Read-only preview',
          'publicShare.previewTitle': 'Preview',
          'publicShare.previewUnavailable': 'Preview is unavailable for this shared item.',
          'publicShare.tableSummary': `${(options as any)?.rows} rows · ${(options as any)?.columns} columns · Read-only snapshot`,
          'portal.openInDocEditor': 'Open in Docs',
          'portal.openInFiles': 'Open in Files',
          'shared.kind.document': 'Document',
          'shared.kind.file': 'File',
          'shared.kind.source_set': 'Source Set',
        }) as Record<string, string>
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
      recordSharedContentExport: { mutate: trpcMocks.recordSharedContentExport },
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
    trpcMocks.recordSharedContentExport.mockReset();
    trpcMocks.recordSharedContentExport.mockResolvedValue({ success: true });

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
    vi.spyOn(document, 'createElement').mockImplementation(((
      tagName: string,
      options?: ElementCreationOptions,
    ) => {
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

    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getAllByText('1 rows · 2 columns · Read-only snapshot')).not.toHaveLength(0);
    expect(
      screen.getByText(`Expires ${formatDateTime(new Date('2026-04-04T12:00:00.000Z'))}`),
    ).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Launch' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Done' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open in Docs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download Excel (.xlsx)' })).toBeInTheDocument();
    expect(screen.queryByTestId('markdown-preview')).not.toBeInTheDocument();
  });

  it('shows an inline validation message when a protected share is submitted without a password', () => {
    swrState.error = new TRPCClientError('SHARE_PASSWORD_REQUIRED', { code: 'UNAUTHORIZED' });

    render(<PublicSharePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(screen.getByText('Enter the password to continue.')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows an inline error when the submitted password is invalid', async () => {
    swrState.error = new TRPCClientError('SHARE_PASSWORD_REQUIRED', { code: 'UNAUTHORIZED' });

    render(<PublicSharePage />);

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() =>
      expect(screen.getByText('That password did not work. Try again.')).toBeInTheDocument(),
    );
  });

  it('downloads shared table documents as csv and records export access', async () => {
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

    await waitFor(() =>
      expect(trpcMocks.recordSharedContentExport).toHaveBeenCalledWith({
        format: 'csv',
        password: undefined,
        token: 'tok_1',
      }),
    );
    expect(downloadMocks.createObjectURL).toHaveBeenCalledTimes(1);
    expect(downloadMocks.linkClick).toHaveBeenCalledTimes(1);
    expect(downloadMocks.revokeObjectURL).toHaveBeenCalledWith('blob:shared-csv');
    expect(downloadMocks.createdLinks.length).toBeGreaterThan(0);
    expect(downloadMocks.createdLinks.at(-1)?.download).toBe('Quarterly Table.csv');
  });

  it('downloads shared table documents as xlsx', async () => {
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

    await waitFor(() =>
      expect(trpcMocks.recordSharedContentExport).toHaveBeenCalledWith({
        format: 'xlsx',
        password: undefined,
        token: 'tok_1',
      }),
    );
    expect(downloadMocks.createObjectURL).toHaveBeenCalledTimes(1);
    expect(downloadMocks.linkClick).toHaveBeenCalledTimes(1);
    expect(downloadMocks.revokeObjectURL).toHaveBeenCalledWith('blob:shared-csv');
    expect(downloadMocks.createdLinks.length).toBeGreaterThan(0);
    expect(downloadMocks.createdLinks.at(-1)?.download).toBe('Quarterly Table.xlsx');
  });

  it('keeps export download working even if export access recording fails', async () => {
    trpcMocks.recordSharedContentExport.mockRejectedValueOnce(new Error('network-error'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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

    await waitFor(() => expect(trpcMocks.recordSharedContentExport).toHaveBeenCalledTimes(1));
    expect(downloadMocks.linkClick).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to record shared content export',
      expect.any(Error),
    );
    errorSpy.mockRestore();
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

    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getAllByText('Read-only preview')).not.toHaveLength(0);
    expect(screen.getByTestId('markdown-preview')).toHaveTextContent('# Shared Doc');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open in Docs' })).toHaveAttribute(
      'data-href',
      '/spaces/spc_1/docs/3',
    );
    expect(screen.queryByRole('button', { name: 'Download CSV' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Download Excel (.xlsx)' }),
    ).not.toBeInTheDocument();
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

    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getAllByText('Preview is unavailable for this shared item.')).not.toHaveLength(0);
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

  it('canonicalizes docs_* file payloads to the docs preview flow', () => {
    swrState.data = {
      content: '# Shared Doc\n\nHello team',
      expiresAt: new Date('2026-04-04T12:00:00.000Z'),
      kind: 'file',
      localId: 'docs_7',
      metadata: { pageKind: 'doc' },
      name: 'Legacy Shared Doc',
      spaceId: 'spc_1',
      title: 'Legacy Shared Doc',
    };

    render(<PublicSharePage />);

    expect(screen.getAllByText('Document')).not.toHaveLength(0);
    expect(screen.getByTestId('markdown-preview')).toHaveTextContent('# Shared Doc');
    expect(screen.getByRole('button', { name: 'Open in Docs' })).toHaveAttribute(
      'data-href',
      '/spaces/spc_1/docs/7',
    );
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open in Files' })).not.toBeInTheDocument();
  });
});
