import { useMemo } from 'react';

import type { FolderCrumb } from '../lib/api';
import type { MobileSpaceItem, SourceSetItem } from '../types';

interface UseResourceSourceSetDerivedProps {
  activeSpaceId: string | null;
  allSourceSets: SourceSetItem[];
  currentFolderId: string | null;
  currentSpaceName: string;
  folderBreadcrumb: FolderCrumb[];
  isUnassignedScope: boolean;
  resourceAllFilesLabel: string;
  resourceSourceSetUnassignedLabel: string;
  resourceTrashTitle: string;
  sourceSetId: string | null;
  spaces: MobileSpaceItem[];
  workspaceTitle: string;
}

export function useResourceSourceSetDerived({
  activeSpaceId,
  allSourceSets,
  currentFolderId,
  currentSpaceName,
  folderBreadcrumb,
  isUnassignedScope,
  resourceAllFilesLabel,
  resourceSourceSetUnassignedLabel,
  resourceTrashTitle,
  sourceSetId,
  spaces,
  workspaceTitle,
}: UseResourceSourceSetDerivedProps) {
  const sourceSets = useMemo(
    () =>
      allSourceSets.filter((item) =>
        activeSpaceId ? (item.spaceId ?? null) === activeSpaceId : true,
      ),
    [activeSpaceId, allSourceSets],
  );

  const sourceSetSpaceId = useMemo(() => {
    if (!sourceSetId) return undefined;
    return allSourceSets.find((item) => item.id === sourceSetId)?.spaceId ?? undefined;
  }, [allSourceSets, sourceSetId]);

  const effectiveSpaceId = sourceSetSpaceId ?? activeSpaceId ?? undefined;

  const availableTargetSourceSets = useMemo(
    () => sourceSets.filter((item) => item.id !== sourceSetId),
    [sourceSetId, sourceSets],
  );

  const currentSourceSetName = useMemo(() => {
    if (!sourceSetId) {
      return isUnassignedScope ? resourceSourceSetUnassignedLabel : resourceAllFilesLabel;
    }

    return allSourceSets.find((item) => item.id === sourceSetId)?.name ?? '';
  }, [
    allSourceSets,
    isUnassignedScope,
    resourceAllFilesLabel,
    resourceSourceSetUnassignedLabel,
    sourceSetId,
  ]);

  const currentSourceRootLabel = currentSourceSetName;
  const currentTreePathLabel = currentFolderId
    ? [currentSourceRootLabel, ...folderBreadcrumb.map((crumb) => crumb.name)].join(' / ')
    : currentSourceRootLabel;
  const workspaceTrashLabel = sourceSetId
    ? `${currentSourceSetName} / ${resourceTrashTitle}`
    : `${currentSpaceName} / ${resourceTrashTitle}`;

  const sourceSetLauncherGroups = useMemo(() => {
    const grouped = new Map<
      string,
      {
        items: SourceSetItem[];
        label: string;
        spaceId: string | null;
      }
    >();

    for (const sourceSet of allSourceSets) {
      const groupKey = sourceSet.spaceId ?? '__no_space__';
      const matchedSpace = sourceSet.spaceId
        ? spaces.find((space) => space.id === sourceSet.spaceId)
        : null;

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          items: [],
          label: matchedSpace?.name ?? workspaceTitle,
          spaceId: sourceSet.spaceId ?? null,
        });
      }

      grouped.get(groupKey)?.items.push(sourceSet);
    }

    const currentGroupKey = activeSpaceId ?? '__no_space__';

    return [...grouped.entries()]
      .sort(([leftKey], [rightKey]) => {
        if (leftKey === currentGroupKey) return -1;
        if (rightKey === currentGroupKey) return 1;

        const leftLabel = grouped.get(leftKey)?.label ?? '';
        const rightLabel = grouped.get(rightKey)?.label ?? '';

        return leftLabel.localeCompare(rightLabel, 'zh-Hans-CN');
      })
      .map(([, group]) => group);
  }, [activeSpaceId, allSourceSets, spaces, workspaceTitle]);

  return {
    availableTargetSourceSets,
    currentSourceRootLabel,
    currentSourceSetName,
    currentTreePathLabel,
    effectiveSpaceId,
    sourceSetLauncherGroups,
    sourceSets,
    workspaceTrashLabel,
  };
}
