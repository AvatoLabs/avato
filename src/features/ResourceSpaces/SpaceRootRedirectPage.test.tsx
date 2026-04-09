/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import SpaceRootRedirectPage from './SpaceRootRedirectPage';

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: any) => <div data-testid={'redirect-target'}>{to}</div>,
  useLocation: () => ({ search: '?from=sidebar' }),
  useParams: () => ({ spaceId: 'spc_personal' }),
}));

vi.mock('./paths', () => ({
  buildFilesRootPath: (spaceId?: string | null) =>
    spaceId ? `/spaces/${spaceId}/files` : '/spaces',
}));

describe('SpaceRootRedirectPage', () => {
  it('always redirects the space root to the canonical files root', () => {
    render(<SpaceRootRedirectPage />);

    expect(screen.getByTestId('redirect-target')).toHaveTextContent(
      '/spaces/spc_personal/files?from=sidebar',
    );
  });
});
