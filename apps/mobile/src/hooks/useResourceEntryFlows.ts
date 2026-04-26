import { useCallback, useEffect } from 'react';

import type { SharedWithMeRow } from '../components/ui/SharedWithMeSheet';
import { notebookApi, resourceApi, sourceSetApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { navigateToNotebook } from '../lib/navigation';
import {
  appendCurrentPortalStackWithOrigin,
  createConversationOrigin,
} from '../lib/portalNavigation';
import {
  fileListItemFromNavigationTarget,
  fileListItemFromShared,
} from '../lib/resourceEntryTarget';
import { getCanonicalResourceKind } from '../lib/resourceList';
import { clearResourceListCache } from '../lib/resourceListCache';
import type {
  ContentRouteParams,
  ConversationOriginRouteParams,
  PortalRouteParams,
} from '../navigation/types';
import type { FileListItem } from '../types';

type ContentScreenRouteName = 'PortalContent' | 'Content';
type ContentScreenRouteParams = (ContentRouteParams & PortalRouteParams) | undefined;

interface ResourceEntryFlowMessages {
  resourceSharedFolderHint: string;
}

interface UseResourceEntryFlowsProps {
  activateSourceSet: (nextSourceSetId: string | null, options?: { resetTree?: boolean }) => void;
  applyFileScope: (nextScope: 'all' | 'unassigned') => void;
  closeSharedWithMe: () => void;
  loadFolderBreadcrumb: (slug: string, spaceId?: string) => Promise<void>;
  loadSourceSets: () => Promise<void>;
  messages: ResourceEntryFlowMessages;
  navigation: {
    setParams: (params?: Partial<NonNullable<ContentScreenRouteParams>>) => void;
  };
  openPreviewWithOrigin: (
    item: FileListItem,
    origin?: ConversationOriginRouteParams | null,
  ) => void;
  resourceOrigin?: ConversationOriginRouteParams | null;
  routeName: ContentScreenRouteName;
  routeParams: ContentScreenRouteParams;
  setActiveSpaceId: React.Dispatch<React.SetStateAction<string | null>>;
  setCurrentFolderId: React.Dispatch<React.SetStateAction<string | null>>;
  setCurrentFolderSlug: React.Dispatch<React.SetStateAction<string | null>>;
  setResourceOrigin: React.Dispatch<React.SetStateAction<ConversationOriginRouteParams | null>>;
  showToast: (type: 'error' | 'info' | 'success', message: string) => void;
}

const EMPTY_NAVIGATION_TARGET_PARAMS = {
  openItem: undefined,
  openItemId: undefined,
  openKind: undefined,
  openSourceSetId: undefined,
  sessionId: undefined,
  threadId: undefined,
  topicId: undefined,
} satisfies Partial<NonNullable<ContentScreenRouteParams>>;

export function useResourceEntryFlows({
  activateSourceSet,
  applyFileScope,
  closeSharedWithMe,
  loadFolderBreadcrumb,
  loadSourceSets,
  messages,
  navigation,
  openPreviewWithOrigin,
  resourceOrigin,
  routeName,
  routeParams,
  setActiveSpaceId,
  setCurrentFolderId,
  setCurrentFolderSlug,
  setResourceOrigin,
  showToast,
}: UseResourceEntryFlowsProps) {
  const consumeNavigationTarget = useCallback(async () => {
    const params = routeParams;
    if (!params) return;

    const { openItem, openItemId, openKind, openSourceSetId, sessionId, threadId, topicId } =
      params;
    const hasNavigationTarget =
      openItem !== undefined ||
      openItemId !== undefined ||
      openKind !== undefined ||
      openSourceSetId !== undefined;

    if (!hasNavigationTarget) return;

    if (openSourceSetId !== undefined) {
      if (openSourceSetId) {
        const targetSourceSet = await sourceSetApi.getById(openSourceSetId).catch(() => undefined);
        if (targetSourceSet?.spaceId) {
          setActiveSpaceId(targetSourceSet.spaceId);
        }

        activateSourceSet(openSourceSetId, { resetTree: true });
      } else {
        applyFileScope('all');
      }
    }

    const nextOrigin =
      createConversationOrigin({
        sessionId,
        ...(threadId ? { threadId } : {}),
        ...(topicId ? { topicId } : {}),
      }) ?? null;

    let previewTarget: FileListItem | null = openItem
      ? fileListItemFromNavigationTarget(openItem)
      : null;

    if (!previewTarget && openItemId && openKind === 'document') {
      const document = await notebookApi.get(openItemId).catch(() => null);

      if (document) {
        setResourceOrigin(nextOrigin);
        navigateToNotebook(
          appendCurrentPortalStackWithOrigin(
            routeName,
            routeParams,
            {
              documentId: openItemId,
            },
            nextOrigin,
          ),
        );
        navigation.setParams(EMPTY_NAVIGATION_TARGET_PARAMS);
        return;
      }

      previewTarget = {
        ...fileListItemFromShared({
          fileType: 'text/plain',
          kind: 'document',
          localId: openItemId,
          name: openItemId,
        }),
      };
    }

    if (!previewTarget && openItemId && openKind === 'file') {
      previewTarget = fileListItemFromShared({
        kind: 'file',
        localId: openItemId,
        name: openItemId,
      });
    }

    setResourceOrigin(nextOrigin);

    if (previewTarget && openKind !== 'source_set') {
      openPreviewWithOrigin(previewTarget, nextOrigin);
    }

    navigation.setParams(EMPTY_NAVIGATION_TARGET_PARAMS);
  }, [
    activateSourceSet,
    applyFileScope,
    navigation,
    openPreviewWithOrigin,
    routeName,
    routeParams,
    setActiveSpaceId,
    setResourceOrigin,
  ]);

  useEffect(() => {
    void consumeNavigationTarget();
  }, [consumeNavigationTarget]);

  const handleSharedWithMePick = useCallback(
    async (row: SharedWithMeRow) => {
      closeSharedWithMe();
      const rowKind =
        row.kind === 'source_set'
          ? row.kind
          : getCanonicalResourceKind({ id: row.localId, kind: row.kind });

      if (row.spaceId) {
        setActiveSpaceId(row.spaceId);
      }

      if (rowKind === 'source_set') {
        activateSourceSet(row.localId, { resetTree: true });
        haptics.success();
        return;
      }

      if (rowKind === 'file') {
        openPreviewWithOrigin(
          fileListItemFromShared({ kind: 'file', localId: row.localId, name: row.name }),
          resourceOrigin,
        );
        return;
      }

      const document = await resourceApi.getDocument(row.localId).catch(() => null);
      const fileType = document?.fileType ?? 'text/plain';
      if (fileType === 'custom/folder') {
        const sourceSetId = document?.sourceSetId;
        if (typeof sourceSetId === 'string' && sourceSetId.length > 0) {
          const slug = document?.slug ?? row.localId;
          activateSourceSet(sourceSetId, { resetTree: true });
          setCurrentFolderId(row.localId);
          setCurrentFolderSlug(slug);
          clearResourceListCache();
          void loadSourceSets();
          void loadFolderBreadcrumb(slug);
          haptics.success();
          return;
        }

        showToast('info', messages.resourceSharedFolderHint);
        return;
      }

      const notebookDocument = await notebookApi.get(row.localId).catch(() => null);
      if (notebookDocument) {
        haptics.light();
        navigateToNotebook(
          appendCurrentPortalStackWithOrigin(
            routeName,
            routeParams,
            {
              documentId: row.localId,
            },
            resourceOrigin,
          ),
        );
        return;
      }

      openPreviewWithOrigin(
        fileListItemFromShared({
          kind: 'document',
          localId: row.localId,
          name: row.name,
          fileType,
        }),
        resourceOrigin,
      );
    },
    [
      activateSourceSet,
      closeSharedWithMe,
      loadFolderBreadcrumb,
      loadSourceSets,
      messages.resourceSharedFolderHint,
      openPreviewWithOrigin,
      resourceOrigin,
      routeName,
      routeParams,
      setActiveSpaceId,
      setCurrentFolderId,
      setCurrentFolderSlug,
      showToast,
    ],
  );

  return {
    handleSharedWithMePick,
  };
}
