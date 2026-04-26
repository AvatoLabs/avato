/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MainMenu from './MainMenu';

const mockHandleNavigate = vi.hoisted(() => vi.fn());
const mockSetPages = vi.hoisted(() => vi.fn());

vi.mock('@lobechat/business-const', () => ({
  SOCIAL_URL: {
    discord: 'https://discord.example.com',
    github: 'https://github.com/lobehub',
  },
}));

vi.mock('@lobehub/ui', () => ({
  Icon: () => null,
}));

vi.mock('@lobehub/ui/icons', () => ({
  DiscordIcon: () => null,
}));

vi.mock('cmdk', () => ({
  Command: {
    Group: ({ children, heading }: any) => (
      <section>
        {heading ? <h2>{heading}</h2> : null}
        {children}
      </section>
    ),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'cmdk.about': 'About',
        'cmdk.communitySupport': 'Community Support',
        'cmdk.contactUs': 'Contact Us',
        'cmdk.keywords.contactUs': 'contact us',
        'cmdk.keywords.discord': 'discord',
        'cmdk.keywords.starGitHub': 'star github',
        'cmdk.keywords.submitIssue': 'submit issue',
        'cmdk.navigate': 'Navigate',
        'cmdk.newAgent': 'New Agent',
        'cmdk.newAgentTeam': 'New Agent Team',
        'cmdk.newPage': 'New Page',
        'cmdk.newSourceSet': 'New Source Set',
        'cmdk.pages': 'Pages',
        'cmdk.resource': 'Resources',
        'cmdk.settings': 'Settings',
        'cmdk.starOnGitHub': 'Star on GitHub',
        'cmdk.submitIssue': 'Submit Issue',
        'cmdk.theme': 'Theme',
      })[key] || key,
  }),
}));

vi.mock('@/config/entryIcons', () => ({
  ACTION_ENTRY_ICONS: {
    createAgent: () => null,
    createGroup: () => null,
    createPage: () => null,
    newTopic: () => null,
  },
  APP_ENTRY_ICONS: {
    resource: () => null,
  },
  SETTINGS_ENTRY_ICONS: {
    common: () => null,
  },
}));

vi.mock('@/config/routes', () => ({
  getNavigableRoutes: () => [
    {
      cmdkKey: 'cmdk.pages',
      icon: () => null,
      id: 'page',
      path: '/docs',
      pathPrefix: '/spaces',
    },
    {
      cmdkKey: 'cmdk.resource',
      icon: () => null,
      id: 'resource',
      path: '/files',
      pathPrefix: '/spaces',
    },
  ],
  getRouteById: () => ({
    icon: () => null,
    id: 'settings',
    path: '/settings',
    pathPrefix: '/settings',
  }),
}));

vi.mock('@/const/url', () => ({
  FEEDBACK: 'https://feedback.example.com',
}));

vi.mock('@/features/ResourceSpaces', () => ({
  buildFilesRootPath: (spaceId?: string | null) => `/spaces/${spaceId}/files`,
  isWorkspaceFilesSurfacePath: (pathname?: string | null) => pathname?.includes('/files'),
}));

vi.mock('@/helpers/activeWorkspaceSpace', () => ({
  resolveWorkspaceSpaceId: () => {
    const match = window.location.pathname.match(/^\/spaces\/([^/]+)/);
    return match?.[1] ?? 'space-hint';
  },
}));

vi.mock('@/hooks/useFeedbackModal', () => ({
  useFeedbackModal: () => ({
    open: vi.fn(),
  }),
}));

vi.mock('@/utils/docs', () => ({
  getPageRootPath: (_kind: string, spaceId?: string | null) => `/spaces/${spaceId}/docs`,
}));

vi.mock('./CommandMenuContext', () => ({
  useCommandMenuContext: () => ({
    menuContext: 'home',
    pages: [],
    pathname: '/spaces/space-route/files',
    setPages: mockSetPages,
  }),
}));

vi.mock('./components', () => ({
  CommandItem: ({ children, onSelect }: any) => (
    <button type="button" onClick={onSelect}>
      {children}
    </button>
  ),
}));

vi.mock('./ContextCommands', () => ({
  default: () => null,
}));

vi.mock('./useCommandMenu', () => ({
  useCommandMenu: () => ({
    handleCreateAgentTeam: vi.fn(),
    handleCreatePage: vi.fn(),
    handleCreateSession: vi.fn(),
    handleCreateSourceSet: vi.fn(),
    handleCreateTopic: vi.fn(),
    handleExternalLink: vi.fn(),
    handleNavigate: mockHandleNavigate,
  }),
}));

describe('MainMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/spaces/space-route/files');
  });

  it('uses the current route workspace when building page navigation targets', () => {
    render(<MainMenu />);

    expect(screen.queryByRole('button', { name: 'Resources' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pages' }));

    expect(mockHandleNavigate).toHaveBeenCalledWith('/spaces/space-route/docs');
  });
});
