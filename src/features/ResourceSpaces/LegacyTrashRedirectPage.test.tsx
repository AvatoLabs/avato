/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import LegacyTrashRedirectPage from './LegacyTrashRedirectPage';

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: any) => <div data-testid={'redirect-target'}>{to}</div>,
  useLocation: () => ({ search: '?scope=source-set%3Ass_1' }),
}));

describe('LegacyTrashRedirectPage', () => {
  it('redirects the legacy trash route to the spaces redirect path', () => {
    render(<LegacyTrashRedirectPage />);

    expect(screen.getByTestId('redirect-target')).toHaveTextContent(
      '/spaces/trash?scope=source-set%3Ass_1',
    );
  });
});
