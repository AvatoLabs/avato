import { render, screen, waitFor } from '@testing-library/react';
import { Fragment, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./components/NavPanelDraggable', () => ({
  NavPanelDraggable: ({ activeContent }: { activeContent: { key: string; node: ReactNode } }) => (
    <div data-testid="nav-panel">
      <div>{activeContent.key}</div>
      {activeContent.node}
    </div>
  ),
}));

vi.mock('@/routes/(main)/home/_layout/SidebarContent', () => ({
  default: () => <div>Home Sidebar</div>,
}));

describe('NavPanelPortal', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('keeps the latest snapshot when an older portal with the same navKey unmounts', async () => {
    const { NavPanelPortal, default: NavPanel } = await import('./index');

    const renderTree = (children: ReactNode) =>
      render(
        <Fragment>
          <NavPanel />
          {children}
        </Fragment>,
      );

    const { rerender } = renderTree(
      <NavPanelPortal key="portal-a" navKey="discover">
        <div>Portal A</div>
      </NavPanelPortal>,
    );

    expect(screen.getByText('Portal A')).toBeInTheDocument();

    rerender(
      <Fragment>
        <NavPanel />
        <NavPanelPortal key="portal-a" navKey="discover">
          <div>Portal A</div>
        </NavPanelPortal>
        <NavPanelPortal key="portal-b" navKey="discover">
          <div>Portal B</div>
        </NavPanelPortal>
      </Fragment>,
    );

    expect(screen.getByText('Portal B')).toBeInTheDocument();

    rerender(
      <Fragment>
        <NavPanel />
        <NavPanelPortal key="portal-b" navKey="discover">
          <div>Portal B</div>
        </NavPanelPortal>
      </Fragment>,
    );

    await waitFor(() => {
      expect(screen.getByText('Portal B')).toBeInTheDocument();
    });

    expect(screen.queryByText('Home Sidebar')).not.toBeInTheDocument();
  });

  it('falls back to the home sidebar after the last portal unmounts', async () => {
    const { NavPanelPortal, default: NavPanel } = await import('./index');

    const { rerender } = render(
      <Fragment>
        <NavPanel />
        <NavPanelPortal navKey="page">
          <div>Page Sidebar</div>
        </NavPanelPortal>
      </Fragment>,
    );

    expect(screen.getByText('Page Sidebar')).toBeInTheDocument();

    rerender(
      <Fragment>
        <NavPanel />
      </Fragment>,
    );

    await waitFor(() => {
      expect(screen.getByText('Home Sidebar')).toBeInTheDocument();
    });

    expect(screen.queryByText('Page Sidebar')).not.toBeInTheDocument();
  });
});
