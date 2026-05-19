import { FileText, FolderOpen } from 'lucide-react-native';
import { useCallback, useMemo } from 'react';

import type { TranslationKeys } from '../lib/i18n';
import {
  getMobileSpaceMemoryInitialSection,
  type MobileSpaceMemoryDrilldownTarget,
} from '../lib/spaceMemorySummary';
import type { RootStackNavigationProp } from '../navigation/types';
import type { MobileSpaceMemorySurfaceContract } from '../types';

interface UseResourceContentHeaderControlsProps {
  currentSpace?: {
    id: string;
    kind: string;
    membershipRole?: string;
  } | null;
  currentSpaceMemorySummaryContract?: Pick<MobileSpaceMemorySurfaceContract, 'sections'> | null;
  currentSpacePendingGovernanceCount: number;
  currentSpacePendingGovernanceTarget?: MobileSpaceMemoryDrilldownTarget | null;
  resourceFolderOpenNeedsSourceSetMessage: string;
  rootNavigation: RootStackNavigationProp;
  t: Pick<
    TranslationKeys,
    'memorySpaceBrowse' | 'memorySpacePendingAction' | 'resourceScopeFiles' | 'resourceScopeTree'
  >;
  toastInfo: (message: string) => void;
}

export function useResourceContentHeaderControls({
  currentSpace,
  currentSpaceMemorySummaryContract,
  currentSpacePendingGovernanceCount,
  currentSpacePendingGovernanceTarget,
  resourceFolderOpenNeedsSourceSetMessage,
  rootNavigation,
  t,
  toastInfo,
}: UseResourceContentHeaderControlsProps) {
  const handleMissingSourceSetFolderOpen = useCallback(() => {
    toastInfo(resourceFolderOpenNeedsSourceSetMessage);
  }, [resourceFolderOpenNeedsSourceSetMessage, toastInfo]);

  const currentSpaceMemoryShortcutLabel =
    currentSpacePendingGovernanceCount > 0
      ? t.memorySpacePendingAction.replace('{count}', String(currentSpacePendingGovernanceCount))
      : t.memorySpaceBrowse;

  const openCurrentSpaceMemory = useCallback(() => {
    if (!currentSpace || currentSpace.kind !== 'team') return;

    if (currentSpacePendingGovernanceTarget) {
      rootNavigation.navigate('SpaceMemory', {
        recallFilter: currentSpacePendingGovernanceTarget.recallFilter,
        section: currentSpacePendingGovernanceTarget.section,
        spaceId: currentSpace.id,
      });
      return;
    }

    rootNavigation.navigate('SpaceMemory', {
      section: getMobileSpaceMemoryInitialSection(currentSpaceMemorySummaryContract ?? undefined),
      spaceId: currentSpace.id,
    });
  }, [
    currentSpace,
    currentSpaceMemorySummaryContract,
    currentSpacePendingGovernanceTarget,
    rootNavigation,
  ]);

  const openScopeSpaceMemory = useMemo(() => {
    if (!currentSpace || currentSpace.kind !== 'team') return undefined;

    return () =>
      rootNavigation.navigate('SpaceMemory', {
        section: currentSpace.membershipRole === 'viewer' ? 'published' : 'inbox',
        spaceId: currentSpace.id,
      });
  }, [currentSpace, rootNavigation]);

  const openSpaceSettings = useCallback(
    (spaceId: string) => {
      rootNavigation.navigate('SpaceSettings', { spaceId });
    },
    [rootNavigation],
  );

  const sourceSetModeItems = useMemo(
    () => [
      { icon: FolderOpen, label: t.resourceScopeTree, value: 'tree' as const },
      { icon: FileText, label: t.resourceScopeFiles, value: 'files' as const },
    ],
    [t.resourceScopeFiles, t.resourceScopeTree],
  );

  return {
    currentSpaceMemoryShortcutLabel,
    handleMissingSourceSetFolderOpen,
    openCurrentSpaceMemory,
    openScopeSpaceMemory,
    openSpaceSettings,
    sourceSetModeItems,
  };
}
