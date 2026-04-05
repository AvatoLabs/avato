/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';

import Nav from './Nav';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockToggleCommandMenu = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ as, children, ...props }: any) => {
    const Component = as || 'div';
    return <Component {...props}>{children}</Component>;
  },
  Tag: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('antd-style', () => ({
  cssVar: {
    colorPrimary: '#1677ff',
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');

  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ spaceId: 'space-route' }),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: (ns?: string) => ({
    t: (key: string, options?: { name?: string }) =>
      ({
        'tab.home': 'Home',
        'tab.pages': 'Pages',
        'tab.resource': 'Resources',
        'tab.search': 'Search',
        'tab.avatoStudio': 'Studio',
        'tab.memory': 'Memory',
        'tab.video': 'Video',
        'new': 'New',
        'workspace.sidebar.currentWorkspace': `In ${options?.name}`,
        'workspace.sidebar.section.navigation': 'Navigation',
      })[key] || (ns === 'setting' && key === 'tab.beta' ? 'Beta' : key),
  }),
}));

vi.mock('@/features/ResourceSpaces', () => ({
  buildFilesRootPath: (spaceId?: string | null) =>
    spaceId ? `/spaces/${spaceId}/files` : '/spaces',
  useSpaceName: (spaceId?: string | null) =>
    ({ 'space-route': 'Ops Workspace', 'space-hint': 'Hint Workspace' })[spaceId || ''],
}));

vi.mock('@/features/NavPanel/components/NavItem', () => ({
  __esModule: true,
  default: ({ hidden, href, title }: any) =>
    hidden ? null : href ? <a href={href}>{title}</a> : <button type="button">{title}</button>,
}));

vi.mock('@/features/NavPanel/glassSidebar.styles', () => ({
  glassSidebarStyles: {
    sectionLabel: 'sectionLabel',
  },
}));

vi.mock('@/config/entryIcons', () => ({
  APP_ENTRY_ICONS: {
    community: () => null,
    home: () => null,
    image: () => null,
    memory: () => null,
    page: () => null,
    resource: () => null,
    search: () => null,
    studio: () => null,
    video: () => null,
  },
}));

vi.mock('@/hooks/useActiveTabKey', () => ({
  useActiveTabKey: () => 'home',
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: (selector: any) =>
    selector({
      toggleCommandMenu: mockToggleCommandMenu,
    }),
}));

vi.mock('@/store/serverConfig', () => ({
  featureFlagsSelectors: (s: any) => s,
  useServerConfigStore: (selector: any) =>
    selector({
      showAiImage: false,
      showMarket: false,
    }),
}));

vi.mock('@/utils/docs', () => ({
  getPageRootPath: (pageKind: string, spaceId?: string | null) =>
    pageKind === 'doc' ? (spaceId ? `/spaces/${spaceId}/docs` : '/docs') : '/docs',
}));

vi.mock('@/utils/navigation', () => ({
  isModifierClick: () => false,
}));

describe('Home Nav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActiveWorkspaceSpaceId('space-hint');
  });

  it('shows the current workspace label and route-aware docs/files links', () => {
    render(<Nav />);

    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('In Ops Workspace')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pages' })).toHaveAttribute(
      'href',
      '/spaces/space-route/docs',
    );
    expect(screen.getByRole('link', { name: 'Resources' })).toHaveAttribute(
      'href',
      '/spaces/space-route/files',
    );
  });
});
