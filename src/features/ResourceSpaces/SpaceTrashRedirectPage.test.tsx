/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SpaceTrashRedirectPage from './SpaceTrashRedirectPage';

const { spacesState } = vi.hoisted(() => ({
  spacesState: {
    current: [] as Array<{ id: string; kind: 'personal' | 'team'; name: string }>,
  },
}));

vi.mock('@lobehub/ui', () => ({
  Center: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: any) => <div data-testid={'redirect-target'}>{to}</div>,
  useLocation: () => ({ search: '?scope=source-set%3Ass_1' }),
}));

vi.mock('swr', () => ({
  default: (key: unknown) =>
    key === 'resource-space-list'
      ? { data: spacesState.current, isLoading: false }
      : { data: undefined, isLoading: false },
}));

vi.mock('@/components/Loading/BrandTextLoading', () => ({
  default: () => <div>Loading</div>,
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    space: {
      listSpaces: {
        query: vi.fn(),
      },
    },
  },
}));

describe('SpaceTrashRedirectPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers the personal space when redirecting to canonical trash', () => {
    spacesState.current = [
      { id: 'spc_personal', kind: 'personal', name: 'My Space' },
      { id: 'spc_ops', kind: 'team', name: 'Ops Space' },
    ];

    render(<SpaceTrashRedirectPage />);

    expect(screen.getByTestId('redirect-target')).toHaveTextContent(
      '/spaces/spc_personal/files/trash?scope=source-set%3Ass_1',
    );
  });

  it('falls back to the first accessible space when no personal space exists', () => {
    spacesState.current = [{ id: 'spc_ops', kind: 'team', name: 'Ops Space' }];

    render(<SpaceTrashRedirectPage />);

    expect(screen.getByTestId('redirect-target')).toHaveTextContent(
      '/spaces/spc_ops/files/trash?scope=source-set%3Ass_1',
    );
  });
});
