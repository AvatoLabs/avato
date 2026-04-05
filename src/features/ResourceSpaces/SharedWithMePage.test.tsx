/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SharedWithMePage from './SharedWithMePage';

const navigateMock = vi.hoisted(() => vi.fn());
const swrState = vi.hoisted(() => ({
  data: undefined as any[] | undefined,
  isLoading: false,
}));

vi.mock('@lobehub/ui', () => ({
  Block: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Flexbox: ({ as, children }: any) => {
    const Component = as || 'div';
    return <Component>{children}</Component>;
  },
  Icon: () => <span aria-hidden="true">icon</span>,
  Text: ({ as, children }: any) => {
    const Component = as || 'span';
    return <Component>{children}</Component>;
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        {
          'shared.empty': 'No shared resources',
          'shared.kind.document': 'Document',
          'shared.kind.file': 'File',
          'shared.kind.source_set': 'Source Set',
          'shared.subtitle': 'Shared with you',
          'shared.title': 'Shared',
        } as Record<string, string>
      )[key] || key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('swr', () => ({
  default: () => ({
    data: swrState.data,
    isLoading: swrState.isLoading,
  }),
}));

vi.mock('@/components/Loading/BrandTextLoading', () => ({
  default: () => <div>Loading</div>,
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    contentShare: {
      listSharedWithMe: { query: vi.fn() },
    },
  },
}));

describe('SharedWithMePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    swrState.data = undefined;
    swrState.isLoading = false;
  });

  it('renders the empty state when there are no shared resources', () => {
    swrState.data = [];

    render(<SharedWithMePage />);

    expect(screen.getByText('Shared')).toBeInTheDocument();
    expect(screen.getByText('No shared resources')).toBeInTheDocument();
  });

  it('navigates shared documents to space-scoped docs routes', () => {
    swrState.data = [
      {
        contentUid: 'cnt_doc_1',
        kind: 'document',
        localId: 'docs_2',
        metadata: { pageKind: 'table' },
        name: 'Shared Table',
        spaceId: 'spc_1',
      },
    ];

    render(<SharedWithMePage />);

    fireEvent.click(screen.getByText('Shared Table').closest('button')!);

    expect(navigateMock).toHaveBeenCalledWith('/spaces/spc_1/docs/table/2');
  });

  it('navigates shared files and source sets to files routes', () => {
    swrState.data = [
      {
        contentUid: 'cnt_file_1',
        kind: 'file',
        localId: 'file_1',
        name: 'Shared File',
        spaceId: 'spc_1',
      },
      {
        contentUid: 'cnt_ss_1',
        kind: 'source_set',
        localId: 'ss_1',
        name: 'Research Set',
        spaceId: 'spc_1',
      },
    ];

    render(<SharedWithMePage />);

    fireEvent.click(screen.getByText('Shared File').closest('button')!);
    fireEvent.click(screen.getByText('Research Set').closest('button')!);

    expect(navigateMock).toHaveBeenNthCalledWith(1, '/spaces/spc_1/files/item/file_1');
    expect(navigateMock).toHaveBeenNthCalledWith(
      2,
      '/spaces/spc_1/files?scope=source-set%3Ass_1',
    );
  });
});
