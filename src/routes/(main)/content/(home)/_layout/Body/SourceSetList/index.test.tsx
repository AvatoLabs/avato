/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SourceSetList from './index';

const sourceSetListState = vi.hoisted(() => ({
  current: {
    data: [] as Array<{
      description?: string | null;
      id: string;
      name: string;
      spaceId?: string | null;
    }>,
    isLoading: false,
  },
}));

const paramsState = vi.hoisted(() => ({
  current: {} as { slug?: string },
}));

const fileScopeState = vi.hoisted(() => ({
  current: { sourceSetId: 'sst_scope' as string | undefined },
}));

const openCreateSourceSetMock = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Center: ({ children }: any) => <div>{children}</div>,
  Flexbox: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
  Icon: () => <span>icon</span>,
  Text: ({ children, className }: any) => <span className={className}>{children}</span>,
}));

vi.mock('antd', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    emptyAction: 'emptyAction',
    emptyState: 'emptyState',
    emptyStateBody: 'emptyStateBody',
    emptyStateDescription: 'emptyStateDescription',
    emptyStateTitle: 'emptyStateTitle',
    listShell: 'listShell',
  }),
  cssVar: {
    colorTextQuaternary: '#999',
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          'emptyState.action': 'Create Source Set',
          'emptyState.description': 'Source sets help you organize and manage your knowledge base',
          'emptyState.title': 'Create your first source set',
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => paramsState.current,
}));

vi.mock('@/features/ContentManager/useFileScope', () => ({
  useFileScope: () => fileScopeState.current,
}));

vi.mock('@/features/NavPanel/components/SkeletonList', () => ({
  default: () => <div>Loading</div>,
}));

vi.mock('@/features/SourceSetModal', () => ({
  useCreateSourceSetModal: () => ({
    open: openCreateSourceSetMock,
  }),
}));

vi.mock('@/routes/(main)/content/features/store', () => ({
  useContentManagerStore: (selector: any) => selector({ spaceId: 'spc_ops' }),
}));

vi.mock('@/store/sourceSet', () => ({
  useSourceSetStore: (selector: any) =>
    selector({
      useFetchSourceSetList: () => sourceSetListState.current,
    }),
}));

vi.mock('./Item', () => ({
  default: ({ active, id, name }: any) => (
    <div data-active={String(Boolean(active))} data-testid={`source-set-item-${id}`}>
      {name}
    </div>
  ),
}));

describe('SourceSetList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    paramsState.current = {};
    fileScopeState.current = { sourceSetId: 'sst_scope' };
    sourceSetListState.current = {
      data: [],
      isLoading: false,
    };
  });

  it('renders a compact empty state and opens the create modal from the CTA', () => {
    render(<SourceSetList />);

    expect(screen.getByTestId('source-set-empty-state')).toBeInTheDocument();
    expect(screen.getByText('Create your first source set')).toBeInTheDocument();
    expect(
      screen.getByText('Source sets help you organize and manage your knowledge base'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create Source Set' }));

    expect(openCreateSourceSetMock).toHaveBeenCalledWith({ spaceId: 'spc_ops' });
  });

  it('renders the list shell and marks the scoped source set as active', () => {
    sourceSetListState.current = {
      data: [
        { description: null, id: 'sst_scope', name: 'Scoped Set', spaceId: 'spc_ops' },
        { description: null, id: 'sst_other', name: 'Other Set', spaceId: 'spc_ops' },
      ],
      isLoading: false,
    };

    render(<SourceSetList />);

    expect(screen.getByTestId('source-set-list-shell')).toBeInTheDocument();
    expect(screen.getByTestId('source-set-item-sst_scope')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('source-set-item-sst_other')).toHaveAttribute('data-active', 'false');
  });
});
