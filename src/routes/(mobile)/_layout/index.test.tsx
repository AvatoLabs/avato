/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/Loading/BrandTextLoading', () => ({
  default: () => <div>loading</div>,
}));

vi.mock('@/layout/AuthProvider/MarketAuth', () => ({
  MarketAuthProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/libs/next/dynamic', () => ({
  default: () => () => null,
}));

vi.mock('@/store/serverConfig', () => ({
  featureFlagsSelectors: (s: any) => s,
  useServerConfigStore: (selector: any) =>
    selector({
      showCloudPromotion: false,
    }),
}));

vi.mock('../../../utils/router', () => ({
  NavigatorRegistrar: () => null,
}));

vi.mock('./NavBar', () => ({
  default: () => <nav>mobile-nav</nav>,
}));

describe('MobileMainLayout', () => {
  const renderLayout = async (path: string) => {
    const { default: MobileMainLayout } = await import('./index');

    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<MobileMainLayout />}>
            <Route element={<div>page</div>} path="*" />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  };

  it('shows the mobile nav on workspace docs routes', async () => {
    await renderLayout('/spaces/spc_team/docs');

    expect(screen.getByText('mobile-nav')).toBeInTheDocument();
  });

  it('hides the mobile nav on non-workspace detail routes', async () => {
    await renderLayout('/agent/123');

    expect(screen.queryByText('mobile-nav')).not.toBeInTheDocument();
  });
});
