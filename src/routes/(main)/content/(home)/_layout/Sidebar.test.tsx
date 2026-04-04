import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import Sidebar from './Sidebar';

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
  });
});
