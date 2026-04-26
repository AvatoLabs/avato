/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import LegacySharedFilesRedirectPage from './LegacySharedFilesRedirectPage';

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: any) => <div data-testid={'redirect-target'}>{to}</div>,
  useLocation: () => ({ search: '?from=legacy' }),
}));

describe('LegacySharedFilesRedirectPage', () => {
  it('redirects the legacy shared route to the canonical spaces path', () => {
    render(<LegacySharedFilesRedirectPage />);

    expect(screen.getByTestId('redirect-target')).toHaveTextContent('/spaces/shared?from=legacy');
  });
});
