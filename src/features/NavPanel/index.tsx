'use client';

import { type PropsWithChildren, type ReactNode } from 'react';
import { memo, useLayoutEffect, useSyncExternalStore } from 'react';

import SidebarContent from '@/routes/(main)/home/_layout/SidebarContent';

import { NavPanelDraggable } from './components/NavPanelDraggable';

export const NAV_PANEL_RIGHT_DRAWER_ID = 'nav-panel-drawer';

type NavPanelSnapshot = {
  key: string;
  node: ReactNode;
} | null;

let currentSnapshot: NavPanelSnapshot = null;
const listeners = new Set<() => void>();

const subscribeNavPanel = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getNavPanelSnapshot = () => currentSnapshot;
const setNavPanelSnapshot = (snapshot: NavPanelSnapshot) => {
  currentSnapshot = snapshot;
  listeners.forEach((listener) => listener());
};

interface NavPanelPortalProps extends PropsWithChildren {
  /**
   * Unique key to trigger transition animation when content changes
   * @example <NavPanelPortal navKey="chat">...</NavPanelPortal>
   */
  navKey?: string;
}

export const NavPanelPortal = memo<NavPanelPortalProps>(({ children, navKey = 'default' }) => {
  useLayoutEffect(() => {
    if (!children) return;

    setNavPanelSnapshot({
      key: navKey,
      node: children,
    });

    return () => {
      // Only clear the snapshot if it still belongs to this portal instance.
      // This prevents a race condition where the old portal's cleanup runs *after*
      // the new portal has already written its snapshot (e.g. during Suspense delay
      // or React concurrent-mode batching), which would wipe the new snapshot and
      // leave the sidebar stuck showing stale content.
      if (currentSnapshot?.key === navKey) {
        setNavPanelSnapshot(null);
      }
    };
  }, [children, navKey]);

  return null;
});

/**
 * Stable fallback shown when no route portal is active (e.g. during Suspense loading).
 * Renders the Home sidebar content directly – intentionally does NOT wrap in another
 * NavPanelPortal to avoid an infinite loop:
 *   snapshot=null → FALLBACK renders Portal → Portal writes snapshot → snapshot≠null
 *   → FALLBACK unmounts Portal → cleanup: snapshot.key==='home' → clears snapshot → loop.
 */
const FALLBACK_HOME_SIDEBAR: NavPanelSnapshot = {
  key: 'home',
  node: <SidebarContent />,
};

const NavPanel = memo(() => {
  const panelContent = useSyncExternalStore(
    subscribeNavPanel,
    getNavPanelSnapshot,
    getNavPanelSnapshot,
  );

  const activeContent = panelContent ?? FALLBACK_HOME_SIDEBAR;

  return (
    <>
      <NavPanelDraggable activeContent={activeContent} />
      <div
        id={NAV_PANEL_RIGHT_DRAWER_ID}
        style={{
          alignSelf: 'stretch',
          flexShrink: 0,
          height: '100%',
          minHeight: 0,
          position: 'relative',
          width: 0,
          zIndex: 10,
        }}
      />
    </>
  );
});

export default NavPanel;
