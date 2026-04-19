import { useCallback, useState } from 'react';

import { type ResourceShareSheetTarget } from '../components/ui/ResourceShareOptionsSheet';
import { notebookApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { navigateToNotebook } from '../lib/navigation';
import { appendCurrentPortalStackWithOrigin } from '../lib/portalNavigation';
import { getCanonicalResourceKind } from '../lib/resourceList';
import type {
  ContentRouteParams,
  ConversationOriginRouteParams,
  PortalRouteParams,
} from '../navigation/types';
import type { FileListItem } from '../types';

interface UseResourcePreviewShareProps {
  currentSourceSetName: string;
  routeName: 'Content' | 'PortalContent';
  routeParams: (ContentRouteParams & PortalRouteParams) | undefined;
  sourceSetId: string | null;
  titleFallback: string;
}

export function useResourcePreviewShare({
  currentSourceSetName,
  routeName,
  routeParams,
  sourceSetId,
  titleFallback,
}: UseResourcePreviewShareProps) {
  const [previewItem, setPreviewItem] = useState<FileListItem | null>(null);
  const [resourceOrigin, setResourceOrigin] = useState<ConversationOriginRouteParams | null>(null);
  const [previewOrigin, setPreviewOrigin] = useState<ConversationOriginRouteParams | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [shareTarget, setShareTarget] = useState<ResourceShareSheetTarget | null>(null);
  const [manageShareTarget, setManageShareTarget] = useState<ResourceShareSheetTarget | null>(null);
  const [sharedWithMeVisible, setSharedWithMeVisible] = useState(false);

  const closePreview = useCallback(() => {
    setPreviewVisible(false);
    setPreviewOrigin(null);
  }, []);

  const clearOrigins = useCallback(() => {
    setResourceOrigin(null);
    setPreviewOrigin(null);
  }, []);

  const openPreviewWithOrigin = useCallback(
    (item: FileListItem, origin?: ConversationOriginRouteParams | null) => {
      haptics.light();
      setPreviewOrigin(origin ?? null);
      setPreviewItem(item);
      setPreviewVisible(true);
    },
    [],
  );

  const handlePreview = useCallback(
    (item: FileListItem) => {
      if (getCanonicalResourceKind(item) !== 'document') {
        openPreviewWithOrigin(item, resourceOrigin);
        return;
      }

      void (async () => {
        const document = await notebookApi.get(item.id).catch(() => null);

        if (document) {
          haptics.light();
          navigateToNotebook(
            appendCurrentPortalStackWithOrigin(
              routeName,
              routeParams,
              {
                documentId: item.id,
              },
              resourceOrigin,
            ),
          );
          return;
        }

        openPreviewWithOrigin(item, resourceOrigin);
      })();
    },
    [openPreviewWithOrigin, resourceOrigin, routeName, routeParams],
  );

  const dismissPreviewForIds = useCallback((idSet: Set<string>) => {
    setPreviewItem((current) => {
      if (!current || !idSet.has(current.id)) return current;
      setPreviewVisible(false);
      return null;
    });
  }, []);

  const replacePreviewItem = useCallback((nextItem: FileListItem, previousId?: string) => {
    const targetId = previousId ?? nextItem.id;
    setPreviewItem((current) =>
      current && (current.id === targetId || current.id === nextItem.id) ? nextItem : current,
    );
  }, []);

  const openItemShareSheet = useCallback((item: FileListItem) => {
    setShareTarget({
      id: item.id,
      kind: getCanonicalResourceKind(item),
      name: item.name || item.id,
    });
  }, []);

  const openShareForSourceSet = useCallback(() => {
    if (!sourceSetId) return;

    setShareTarget({
      id: sourceSetId,
      kind: 'source_set',
      name: currentSourceSetName || titleFallback,
    });
  }, [currentSourceSetName, sourceSetId, titleFallback]);

  const openManageShareFromItem = useCallback((item: FileListItem) => {
    setManageShareTarget({
      id: item.id,
      kind: getCanonicalResourceKind(item),
      name: item.name || item.id,
    });
  }, []);

  const openManageShareForSourceSet = useCallback(() => {
    if (!sourceSetId) return;

    setManageShareTarget({
      id: sourceSetId,
      kind: 'source_set',
      name: currentSourceSetName || titleFallback,
    });
  }, [currentSourceSetName, sourceSetId, titleFallback]);

  return {
    clearOrigins,
    closeManageShare: () => setManageShareTarget(null),
    closePreview,
    closeShare: () => setShareTarget(null),
    closeSharedWithMe: () => setSharedWithMeVisible(false),
    dismissPreviewForIds,
    handlePreview,
    manageShareTarget,
    openItemShareSheet,
    openManageShareForSourceSet,
    openManageShareFromItem,
    openPreviewWithOrigin,
    openShareForSourceSet,
    openSharedWithMe: () => setSharedWithMeVisible(true),
    previewItem,
    previewOrigin,
    previewVisible,
    replacePreviewItem,
    resourceOrigin,
    setResourceOrigin,
    shareTarget,
    sharedWithMeVisible,
  };
}
