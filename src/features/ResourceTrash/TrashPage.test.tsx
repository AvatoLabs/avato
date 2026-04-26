/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TrashPage from './TrashPage';

const { searchParamsState, storeState } = vi.hoisted(() => ({
  searchParamsState: {
    current: new URLSearchParams(),
  },
  storeState: {
    setSourceSetId: vi.fn(),
    setSpaceId: vi.fn(),
  },
}));

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ spaceId: 'spc_ops' }),
  useSearchParams: () => [searchParamsState.current],
}));

vi.mock('@/features/ContentManager/useFileScope', () => ({
  getFileScope: (searchParams: URLSearchParams) => searchParams.get('scope') || 'all',
  getSourceSetScopeId: (scope: string) =>
    scope.startsWith('source-set:') ? scope.slice('source-set:'.length) : null,
}));

vi.mock('@/routes/(main)/content/features/store', () => ({
  useContentManagerStore: (selector: any) => selector(storeState),
}));

vi.mock('./TrashContent', () => ({
  TrashContent: ({ sourceSetId, spaceId }: any) => (
    <div data-testid={'trash-content'}>{`${spaceId}:${sourceSetId ?? 'none'}`}</div>
  ),
}));

describe('TrashPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsState.current = new URLSearchParams('scope=source-set:ss_ops');
  });

  it('derives the source set scope from the query string', () => {
    render(<TrashPage />);

    expect(storeState.setSpaceId).toHaveBeenCalledWith('spc_ops');
    expect(storeState.setSourceSetId).toHaveBeenCalledWith('ss_ops');
    expect(screen.getByTestId('trash-content')).toHaveTextContent('spc_ops:ss_ops');
  });
});
