import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import Sidebar from './Sidebar';

const accordionProps = vi.hoisted(() => ({
  current: null as null | { defaultExpandedKeys?: string[]; gap?: number },
}));

vi.mock('@lobehub/ui', () => ({
  Accordion: ({
    children,
    defaultExpandedKeys,
    gap,
  }: {
    children: React.ReactNode;
    defaultExpandedKeys?: string[];
    gap?: number;
  }) => {
    accordionProps.current = { defaultExpandedKeys, gap };

    return <div data-testid="sidebar-accordion">{children}</div>;
  },
  Flexbox: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/NavPanel', () => ({
  NavPanelPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/NavPanel/SideBarLayout', () => ({
  default: ({ body, header }: { body: React.ReactNode; header: React.ReactNode }) => (
    <div>
      <div data-testid="sidebar-header">{header}</div>
      <div data-testid="sidebar-body">{body}</div>
    </div>
  ),
}));

vi.mock('@/features/ResourceSpaces/QuickAccessSection', () => ({
  default: ({ itemKey }: { itemKey: string }) => <div>{`quick-access:${itemKey}`}</div>,
}));

vi.mock('@/features/ResourceSpaces/SpaceSection', () => ({
  default: ({ itemKey }: { itemKey: string }) => <div>{`spaces:${itemKey}`}</div>,
}));

vi.mock('./FileScopeSection', () => ({
  default: ({ itemKey }: { itemKey: string }) => <div>{`file-scope:${itemKey}`}</div>,
}));

vi.mock('./Body', () => ({
  default: ({ itemKey }: { itemKey: string }) => <div>{`source-sets:${itemKey}`}</div>,
}));

vi.mock('./Header', () => ({
  default: () => <div>sidebar-header</div>,
}));

describe('ResourceHomeSidebar', () => {
  it('renders quick access and spaces on the spaces root', () => {
    render(
      <MemoryRouter initialEntries={['/spaces']}>
        <Routes>
          <Route element={<Sidebar />} path="/spaces" />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('quick-access:quick-access')).toBeInTheDocument();
    expect(screen.getByText('spaces:space')).toBeInTheDocument();
    expect(screen.queryByText('file-scope:file-scope')).not.toBeInTheDocument();
    expect(screen.queryByText('source-sets:source-set')).not.toBeInTheDocument();
    expect(accordionProps.current).toMatchObject({
      defaultExpandedKeys: ['space', 'quick-access'],
      gap: 8,
    });
    expect(screen.getByTestId('sidebar-accordion').textContent).toBe(
      'spaces:spacequick-access:quick-access',
    );
  });

  it('renders source sets when a space is active', () => {
    render(
      <MemoryRouter initialEntries={['/spaces/spc_test/files']}>
        <Routes>
          <Route element={<Sidebar />} path="/spaces/:spaceId/files" />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('quick-access:quick-access')).toBeInTheDocument();
    expect(screen.getByText('spaces:space')).toBeInTheDocument();
    expect(screen.getByText('file-scope:file-scope')).toBeInTheDocument();
    expect(screen.getByText('source-sets:source-set')).toBeInTheDocument();
    expect(accordionProps.current).toMatchObject({
      defaultExpandedKeys: ['space', 'file-scope', 'source-set'],
      gap: 8,
    });
    expect(screen.getByTestId('sidebar-accordion').textContent).toBe(
      'spaces:spacefile-scope:file-scopesource-sets:source-setquick-access:quick-access',
    );
  });
});
