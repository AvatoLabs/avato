'use client';

import { type PropsWithChildren, type ReactNode } from 'react';
import { memo, useLayoutEffect, useSyncExternalStore } from 'react';

import SidebarContent from '@/routes/(main)/home/_layout/SidebarContent';

import { NavPanelDraggable } from './components/NavPanelDraggable';

export const NAV_PANEL_RIGHT_DRAWER_ID = 'nav-panel-drawer';

type NavPanelContent = {
  key: string;
  node: ReactNode;
};

type NavPanelSnapshot = (NavPanelContent & { owner: symbol }) | null;

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

    const owner = Symbol(navKey);

    setNavPanelSnapshot({
      key: navKey,
      node: children,
      owner,
    });

    return () => {
      // Let the next portal commit within the same render pass before deciding
      // whether this snapshot should be cleared.
      queueMicrotask(() => {
        // Only clear the snapshot if it still belongs to this exact write.
        // Comparing by navKey is insufficient because multiple portal instances
        // can legitimately reuse the same key across route transitions.
        if (currentSnapshot?.owner === owner) {
          setNavPanelSnapshot(null);
        }
      });
    };
  }, [children, navKey]);

  return null;
});

/**
 * Stable fallback shown when no route portal is active (e.g. during Suspense loading).
 * Renders the Home sidebar content directly – intentionally does NOT wrap in another
 * NavPanelPortal to avoid an infinite loop:
 *   snapshot=null → FALLBACK renders Portal → Portal writes snapshot → snapshot≠null
 *   → FALLBACK unmounts Portal → cleanup sees the same snapshot owner → clears snapshot → loop.
 */
const FALLBACK_HOME_SIDEBAR: NavPanelContent = {
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
