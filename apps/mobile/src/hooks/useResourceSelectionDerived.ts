import { useMemo } from 'react';

import type { FileListItem } from '../types';

const isFolder = (item: FileListItem) => item.fileType === 'custom/folder';

interface UseResourceSelectionDerivedProps {
  resourceItemsById: Map<string, FileListItem>;
  selectedIds: Set<string>;
  selectionCountLabelTemplate: string;
}

export function useResourceSelectionDerived({
  resourceItemsById,
  selectedIds,
  selectionCountLabelTemplate,
}: UseResourceSelectionDerivedProps) {
  const selectionSummaryLabel = useMemo(
    () => selectionCountLabelTemplate.replace('{count}', String(selectedIds.size)),
    [selectedIds.size, selectionCountLabelTemplate],
  );

  const selectedSourceSetEligibleIds = useMemo(
    () =>
      Array.from(selectedIds).filter((id) => {
        const item = resourceItemsById.get(id);
        return Boolean(item && !isFolder(item));
      }),
    [resourceItemsById, selectedIds],
  );

  const selectedHasSourceSetUnsupportedItems = useMemo(
    () =>
      Array.from(selectedIds).some((id) => {
        const item = resourceItemsById.get(id);
        return Boolean(item && isFolder(item));
      }),
    [resourceItemsById, selectedIds],
  );

  return {
    selectedHasSourceSetUnsupportedItems,
    selectedSourceSetEligibleIds,
    selectionSummaryLabel,
  };
}
