/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MemorySidebarPortal from './MemorySidebarPortal';

const { toggleCommandMenuMock, subSidebarTitleBarMock } = vi.hoisted(() => ({
  subSidebarTitleBarMock: vi.fn(),
  toggleCommandMenuMock: vi.fn(),
}));

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ onClick, title }: any) => (
    <button aria-label={title} type={'button'} onClick={onClick} />
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        {
          'tab.search': 'Search',
          title: 'Memory',
        } as Record<string, string>
      )[key] ?? key,
  }),
}));

vi.mock('@/features/NavPanel', () => ({
  NavPanelPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/NavPanel/SideBarLayout', () => ({
  default: ({ body, header }: { body: React.ReactNode; header: React.ReactNode }) => (
    <div>
      <div data-testid={'memory-sidebar-header'}>{header}</div>
      <div data-testid={'memory-sidebar-body'}>{body}</div>
    </div>
  ),
}));

vi.mock('@/features/NavPanel/components/SubSidebarTitleBar', () => ({
  default: (props: any) => {
    subSidebarTitleBarMock(props);

    return (
      <div>
        <span>{props.title}</span>
        <span>{props.titleTo}</span>
        {props.right}
      </div>
    );
  },
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: (selector: any) =>
    selector({
      toggleCommandMenu: toggleCommandMenuMock,
    }),
}));

vi.mock('./MemoryScopeSection', () => ({
  default: ({ activeSpaceId, currentScope }: { activeSpaceId?: string; currentScope: string }) => (
    <div>{`scope:${currentScope}:${activeSpaceId ?? 'none'}`}</div>
  ),
}));

describe('MemorySidebarPortal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the personal memory root in personal scope and exposes a single search action', () => {
    render(<MemorySidebarPortal currentScope={'personal'} />);

    expect(screen.getByText('scope:personal:none')).toBeInTheDocument();
    expect(subSidebarTitleBarMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Memory',
        titleTo: '/memory',
      }),
    );
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
    expect(screen.queryByText('tab.home')).not.toBeInTheDocument();
  });

  it('links the title bar to the active space memory root for space scope', () => {
    render(<MemorySidebarPortal activeSpaceId={'spc_team'} currentScope={'space'} />);

    expect(screen.getByText('scope:space:spc_team')).toBeInTheDocument();
    expect(subSidebarTitleBarMock).toHaveBeenCalledWith(
      expect.objectContaining({
        titleTo: '/spaces/spc_team/memory',
      }),
    );
  });

  it('opens the command menu from the title bar search action', () => {
    render(<MemorySidebarPortal currentScope={'personal'} />);

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(toggleCommandMenuMock).toHaveBeenCalledWith(true);
  });
});
