import { useNavigation } from '@react-navigation/native';
import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';

import { useToast } from '../components/ui/Toast';
import { useResourceContentHeaderControls } from '../hooks/useResourceContentHeaderControls';
import { useResourceContentLayout } from '../hooks/useResourceContentLayout';
import { useResourceContentMessages } from '../hooks/useResourceContentMessages';
import { useResourceGovernanceFilters } from '../hooks/useResourceGovernanceFilters';
import { useResourcePreviewCache } from '../hooks/useResourcePreviewCache';
import { useResourcePreviewShare } from '../hooks/useResourcePreviewShare';
import { useResourceScopeNavigation } from '../hooks/useResourceScopeNavigation';
import { useResourceSourceSetDerived } from '../hooks/useResourceSourceSetDerived';
import { useResourceSpaceCreate } from '../hooks/useResourceSpaceCreate';
import { useResourceSpaces } from '../hooks/useResourceSpaces';
import { useResourceSurfaceControls } from '../hooks/useResourceSurfaceControls';
import { useI18n } from '../lib/i18n';
import type { SourceSetDirectoryStatus } from '../lib/resourceSourceSet';
import type { RootStackNavigationProp } from '../navigation/types';
import { useFileStore } from '../store/file';
import type { FileListItem, SourceSetItem } from '../types';
import type { UseResourceContentScreenProps } from './useResourceContentScreen';

type FileCategory = 'all' | 'images' | 'documents' | 'others';
const GOVERNANCE_FILTERS_ENABLED = false;

export function useResourceContentState({ route }: Pick<UseResourceContentScreenProps, 'route'>) {
  const { locale, t } = useI18n();
  const rootNavigation = useNavigation<RootStackNavigationProp>();
  const toast = useToast();
  const layout = useResourceContentLayout();
  const addChatContextSelection = useFileStore((s) => s.addChatContextSelection);

  const [category, setCategory] = useState<FileCategory>('all');
  const [allSourceSets, setAllSourceSets] = useState<SourceSetItem[]>([]);
  const [sourceSetDirectoryStatus, setSourceSetDirectoryStatus] =
    useState<SourceSetDirectoryStatus>('idle');
  const [treeChildrenByParent, setTreeChildrenByParent] = useState<Record<string, FileListItem[]>>(
    {},
  );
  const [treeExpandedIds, setTreeExpandedIds] = useState<Set<string>>(() => new Set());
  const searchRef = useRef<TextInput>(null);
  const previewCache = useResourcePreviewCache();
  const messages = useResourceContentMessages();
  const surfaceControls = useResourceSurfaceControls({
    messages: messages.sortMessages,
  });

  const scopeNavigation = useResourceScopeNavigation({
    allSourceSets,
    sourceSetDirectoryStatus,
    treeChildrenByParent,
    treeExpandedIds,
    setTreeChildrenByParent,
    setTreeExpandedIds,
  });

  const spaces = useResourceSpaces({
    activeSpaceId: scopeNavigation.activeSpaceId,
    currentFolderSlug: scopeNavigation.currentFolderSlug,
    effectiveSpaceId: scopeNavigation.sourceSetId
      ? (allSourceSets.find((item) => item.id === scopeNavigation.sourceSetId)?.spaceId ??
        undefined)
      : (scopeNavigation.activeSpaceId ?? undefined),
    setActiveSpaceId: scopeNavigation.setActiveSpaceId,
    setFolderBreadcrumb: scopeNavigation.setFolderBreadcrumb,
    showToast: toast.show,
    workspaceLoadFailedMessage: t.workspaceLoadFailed,
  });

  const spaceCreate = useResourceSpaceCreate({
    applyFileScope: scopeNavigation.applyFileScope,
    closeScopeLauncher: scopeNavigation.closeScopeLauncher,
    loadSpaces: spaces.loadSpaces,
    messages: messages.spaceCreateMessages,
    setActiveSpaceId: scopeNavigation.setActiveSpaceId,
    showToast: toast.show,
  });

  const effectiveCategory = scopeNavigation.isSourceSetScope ? undefined : category;
  const currentSpaceName = spaces.currentSpace?.name?.trim() || t.workspaceTitle;
  const sourceSetDerived = useResourceSourceSetDerived({
    activeSpaceId: scopeNavigation.activeSpaceId,
    allSourceSets,
    currentFolderId: scopeNavigation.currentFolderId,
    currentSpaceName,
    folderBreadcrumb: scopeNavigation.folderBreadcrumb,
    isUnassignedScope: scopeNavigation.isUnassignedScope,
    resourceAllFilesLabel: t.resourceAllFiles,
    resourceSourceSetUnassignedLabel: t.resourceSourceSetUnassigned,
    resourceTrashTitle: t.resourceTrashTitle,
    sourceSetId: scopeNavigation.sourceSetId,
    spaces: spaces.spaces,
    workspaceTitle: t.workspaceTitle,
  });

  const governance = useResourceGovernanceFilters({
    enabled: GOVERNANCE_FILTERS_ENABLED,
    messages: messages.governanceFilterMessages,
  });

  const previewShare = useResourcePreviewShare({
    currentSourceSetName: sourceSetDerived.currentSourceSetName,
    routeName: route.name,
    routeParams: route.params,
    sourceSetId: scopeNavigation.sourceSetId,
    titleFallback: t.resourceTitle,
  });

  const headerControls = useResourceContentHeaderControls({
    currentSpace: spaces.currentSpace,
    currentSpaceMemorySummaryContract: spaces.currentSpaceMemorySummary?.contract,
    currentSpacePendingGovernanceCount: spaces.currentSpacePendingGovernanceCount,
    currentSpacePendingGovernanceTarget: spaces.currentSpacePendingGovernanceTarget,
    resourceFolderOpenNeedsSourceSetMessage: t.resourceFolderOpenNeedsSourceSet,
    rootNavigation,
    t,
    toastInfo: (message) => toast.show('info', message),
  });

  return {
    addChatContextSelection,
    allSourceSets,
    category,
    currentSpaceName,
    effectiveCategory,
    governance,
    governanceEnabled: GOVERNANCE_FILTERS_ENABLED,
    headerControls,
    layout,
    locale,
    messages,
    previewCache,
    previewShare,
    scopeNavigation,
    searchRef,
    setAllSourceSets,
    setCategory,
    setSourceSetDirectoryStatus,
    setTreeChildrenByParent,
    setTreeExpandedIds,
    sourceSetDirectoryStatus,
    sourceSetDerived,
    spaceCreate,
    spaces,
    surfaceControls,
    t,
    toast,
    treeChildrenByParent,
    treeExpandedIds,
  };
}

export type ResourceContentStateResult = ReturnType<typeof useResourceContentState>;
