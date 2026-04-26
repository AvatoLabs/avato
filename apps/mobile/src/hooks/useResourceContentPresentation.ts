import { useCallback, useMemo } from 'react';

import { navigateBackFromPortal } from '../lib/navigation';
import { getPreviousPortalTarget } from '../lib/portalNavigation';
import type { ResourceCacheEntry } from '../lib/resourceCache';
import type {
  ContentRouteParams,
  ConversationOriginRouteParams,
  PortalRouteParams,
} from '../navigation/types';
import type { FileListItem } from '../types';
import { useWarmResourcePreviewCache } from './useResourcePreviewCache';

interface PortalBackNavigation {
  canGoBack: () => boolean;
  goBack: () => void;
}

interface ResourceTreeRow {
  depth: number;
  item: FileListItem;
}

interface UseResourceContentPresentationProps {
  applyCachedResourceEntry: (entry: ResourceCacheEntry) => void;
  cachedResourceIds: Set<string>;
  cachedResourceMap: Record<string, ResourceCacheEntry>;
  currentFolderId: string | null;
  filtered: FileListItem[];
  navigation: PortalBackNavigation;
  previewItem: FileListItem | null;
  resourceOrigin?: ConversationOriginRouteParams | null;
  routeName: 'Content' | 'PortalContent';
  routeParams: (ContentRouteParams & PortalRouteParams) | undefined;
  selectedIds: Set<string>;
  selectMode: boolean;
  treeExpandedIds: Set<string>;
  treeMode: boolean;
  treeRows: ResourceTreeRow[];
  visibleIds: Set<string>;
}

export function useResourceContentPresentation({
  applyCachedResourceEntry,
  cachedResourceIds,
  cachedResourceMap,
  currentFolderId,
  filtered,
  navigation,
  previewItem,
  resourceOrigin,
  routeName,
  routeParams,
  selectMode,
  selectedIds,
  treeExpandedIds,
  treeMode,
  treeRows,
  visibleIds,
}: UseResourceContentPresentationProps) {
  const listExtraData = useMemo(
    () => ({
      cachedResourceIds,
      cachedResourceMap,
      currentFolderId,
      selectedIds,
      selectMode,
      treeExpandedIds,
      visibleIds,
    }),
    [
      cachedResourceIds,
      cachedResourceMap,
      currentFolderId,
      selectedIds,
      selectMode,
      treeExpandedIds,
      visibleIds,
    ],
  );

  useWarmResourcePreviewCache({
    applyCachedResourceEntry,
    cachedResourceIds,
    filteredItems: filtered,
    treeMode,
    treeRows,
    visibleIds,
  });

  const previousPortalTarget = getPreviousPortalTarget(routeParams?.portalStack);

  const handlePortalBack = useCallback(() => {
    navigateBackFromPortal({
      conversationOrigin: resourceOrigin,
      navigation,
      portalStack: routeParams?.portalStack,
    });
  }, [navigation, resourceOrigin, routeParams?.portalStack]);

  return {
    handlePortalBack,
    listExtraData,
    portalProps: {
      active: routeName === 'PortalContent',
      currentLabel: previewItem?.name,
      onDismiss: routeName === 'PortalContent' ? handlePortalBack : undefined,
      onPressLeft: previousPortalTarget ? handlePortalBack : undefined,
      routeName,
      routeParams,
    },
    previousPortalTarget,
  };
}

export type ResourceContentPresentation = ReturnType<typeof useResourceContentPresentation>;
