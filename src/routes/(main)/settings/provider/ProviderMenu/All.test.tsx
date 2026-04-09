/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import All from './All';

const routerState = vi.hoisted(() => ({
  pathname: '/settings',
  provider: 'all',
}));

vi.mock('lucide-react', () => ({
  WalletCards: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({
    pathname: routerState.pathname,
  }),
  useSearchParams: () => [
    {
      get: (key: string) => (key === 'provider' ? routerState.provider : null),
    },
  ],
}));

vi.mock('@/features/NavPanel/components/NavItem', () => ({
  default: ({ active, title }: any) => <div data-active={active ? 'true' : 'false'}>{title}</div>,
}));

describe('ProviderMenu All', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerState.pathname = '/settings';
    routerState.provider = 'all';
  });

  it('uses legacy query params as a fallback for active state', () => {
    render(<All onClick={vi.fn()} />);

    expect(screen.getByText('menu.all')).toHaveAttribute('data-active', 'true');
  });
});
