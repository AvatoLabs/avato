import { usePathname, useSearchParams } from '@/libs/router/navigation';
import { SettingsTabs, SidebarTabKey } from '@/store/global/initialState';

/**
 * Returns the active tab key (chat/market/settings/...)
 * React Router version for SPA
 */
export const useActiveTabKey = () => {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];

  if (firstSegment === 'spaces') {
    const surface = segments[2];

    if (surface === 'docs') return 'docs' as SidebarTabKey;
    if (surface === 'memory') return 'memory' as SidebarTabKey;
    if (surface === 'files' || surface === 'settings' || surface === 'members') {
      return 'content' as SidebarTabKey;
    }
  }

  return (firstSegment as SidebarTabKey) || SidebarTabKey.Home;
};

/**
 * Returns the active setting page key (?active=common/sync/agent/...)
 * React Router version for SPA
 */
export const useActiveSettingsKey = () => {
  const [searchParams] = useSearchParams();
  const tabs = searchParams.get('active');
  if (!tabs) return SettingsTabs.Common;
  return tabs as SettingsTabs;
};

/**
 * Returns the active profile page key (profile/security/stats/...)
 * React Router version for SPA
 */
export const useActiveProfileKey = () => {
  const pathname = usePathname();

  const tabs = pathname.split('/').at(-1);

  if (tabs === 'profile') return 'profile';

  return tabs;
};
