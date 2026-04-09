/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProviderItem from './Item';

const routerState = vi.hoisted(() => ({
  pathname: '/settings',
  provider: 'openai',
}));

vi.mock('@lobechat/business-const', () => ({
  BRANDING_PROVIDER: 'branding',
}));

vi.mock('@lobehub/icons', () => ({
  ProviderIcon: () => null,
}));

vi.mock('@lobehub/ui', () => ({
  Avatar: () => null,
  Center: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('antd', () => ({
  Badge: () => null,
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

vi.mock('@/business/client/features/BrandingProviderCard', () => ({
  BrandingProviderCard: () => null,
}));

vi.mock('@/components/Branding/ProductLogo', () => ({
  ProductLogo: () => null,
}));

vi.mock('@/const/version', () => ({
  isCustomBranding: false,
}));

vi.mock('@/features/NavPanel/components/NavItem', () => ({
  default: ({ active, title }: any) => <div data-active={active ? 'true' : 'false'}>{title}</div>,
}));

describe('ProviderMenu Item', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerState.pathname = '/settings';
    routerState.provider = 'openai';
  });

  it('uses legacy query params as a fallback for active state', () => {
    render(
      <ProviderItem
        enabled={true}
        id="openai"
        name="OpenAI"
        onClick={vi.fn()}
        source={'builtin' as any}
      />,
    );

    expect(screen.getByText('OpenAI')).toHaveAttribute('data-active', 'true');
  });
});
