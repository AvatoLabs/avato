/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TrashNavItem } from './TrashNavItem';

const { locationState, navigateMock, navItemPropsState, searchParamsState } = vi.hoisted(() => ({
  locationState: {
    pathname: '/spaces/spc_ops/files/trash',
  },
  navigateMock: vi.fn(),
  navItemPropsState: {
    current: null as Record<string, unknown> | null,
  },
  searchParamsState: {
    current: new URLSearchParams(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => locationState,
  useNavigate: () => navigateMock,
  useSearchParams: () => [searchParamsState.current],
}));

vi.mock('@/features/ContentManager/useFileScope', () => ({
  getFileScope: (searchParams: URLSearchParams) => searchParams.get('scope') || 'all',
  getSourceSetScopeId: (scope: string) =>
    scope.startsWith('source-set:') ? scope.slice('source-set:'.length) : null,
}));

vi.mock('@/features/NavPanel/components/NavItem', () => ({
  default: (props: any) => {
    navItemPropsState.current = props;
    return <button type={'button'} onClick={props.onClick}>{String(props.title)}</button>;
  },
}));

describe('TrashNavItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navItemPropsState.current = null;
    locationState.pathname = '/spaces/spc_ops/files/trash';
    searchParamsState.current = new URLSearchParams('scope=source-set:ss_ops');
  });

  it('treats source-set trash as active when the current scope matches', () => {
    render(<TrashNavItem sourceSetId="ss_ops" spaceId="spc_ops" title="Scoped Trash" />);

    expect(navItemPropsState.current).toMatchObject({ active: true, title: 'Scoped Trash' });
  });

  it('does not mark the item active when the current source-set scope differs', () => {
    searchParamsState.current = new URLSearchParams('scope=source-set:ss_other');

    render(<TrashNavItem sourceSetId="ss_ops" spaceId="spc_ops" />);

    expect(navItemPropsState.current).toMatchObject({ active: false });
  });
});
