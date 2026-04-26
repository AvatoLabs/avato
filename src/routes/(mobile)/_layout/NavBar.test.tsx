/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';

import NavBar from './NavBar';

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Icon: () => <span>icon</span>,
}));

vi.mock('@lobehub/ui/mobile', () => ({
  TabBar: ({ items }: any) => (
    <div>
      {items.map((item: any) => (
        <button key={item.key} type="button" onClick={item.onClick}>
          {item.title}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    active: 'active',
    container: 'container',
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'tab.chat': 'Chat',
        'tab.community': 'Community',
        'tab.me': 'Me',
        'tab.resource': 'Resources',
      })[key] || key,
  }),
}));

vi.mock('@/config/entryIcons', () => ({
  APP_ENTRY_ICONS: {
    chat: () => null,
    community: () => null,
    me: () => null,
    resource: () => null,
  },
}));

vi.mock('@/const/layoutTokens', () => ({
  MOBILE_TABBAR_HEIGHT: 56,
}));

vi.mock('@/features/ResourceSpaces', () => ({
  buildFilesRootPath: (spaceId?: string | null) =>
    spaceId ? `/spaces/${spaceId}/files` : '/spaces',
}));

vi.mock('@/hooks/useActiveTabKey', () => ({
  useActiveTabKey: () => 'content',
}));

vi.mock('@/store/serverConfig', () => ({
  featureFlagsSelectors: (s: any) => s,
  useServerConfigStore: (selector: any) =>
    selector({
      showMarket: false,
    }),
}));

describe('Mobile NavBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActiveWorkspaceSpaceId('space-hint');
    window.history.replaceState({}, '', '/spaces/space-route/files');
  });

  it('opens resources in the current route workspace instead of the mutable hint', () => {
    render(<NavBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Resources' }));

    expect(mockNavigate).toHaveBeenCalledWith('/spaces/space-route/files');
  });
});
