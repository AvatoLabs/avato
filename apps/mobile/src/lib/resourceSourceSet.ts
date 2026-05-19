import type { FileListItem,SourceSetItem } from '../types';
import { getCanonicalResourceKind } from './resourceList';

export type SourceSetDirectoryStatus = 'idle' | 'loading' | 'success' | 'error';

interface ShouldFallbackSourceSetScopeParams {
  pendingSourceSetSelectionId: string | null;
  sourceSetDirectoryStatus: SourceSetDirectoryStatus;
  sourceSetId: string | null;
  sourceSets: SourceSetItem[];
}

export function shouldFallbackSourceSetScope({
  pendingSourceSetSelectionId,
  sourceSetDirectoryStatus,
  sourceSetId,
  sourceSets,
}: ShouldFallbackSourceSetScopeParams) {
  if (!sourceSetId) return false;
  if (pendingSourceSetSelectionId) return false;
  if (sourceSetDirectoryStatus !== 'success') return false;

  return !sourceSets.some((item) => item.id === sourceSetId);
}

interface MoveFilesBetweenSourceSetsDeps {
  addFiles: (sourceSetId: string, ids: string[]) => Promise<unknown>;
  moveResourceToRoot: (id: string, kind: 'document' | 'file') => Promise<unknown>;
  removeFiles: (sourceSetId: string, ids: string[]) => Promise<unknown>;
}

interface MoveFilesBetweenSourceSetsParams {
  currentSourceSetId: string | null;
  ids: string[];
  resourceItemsById: Map<string, FileListItem>;
  targetSourceSetId: string;
}

export async function moveFilesBetweenSourceSets(
  { currentSourceSetId, ids, resourceItemsById, targetSourceSetId }: MoveFilesBetweenSourceSetsParams,
  deps: MoveFilesBetweenSourceSetsDeps,
) {
  await deps.addFiles(targetSourceSetId, ids);

  const nestedItems = ids.flatMap((id) => {
    const item = resourceItemsById.get(id);
    if (!item?.parentId) return [];

    return [{ id, kind: getCanonicalResourceKind(item) }] as const;
  });

  await Promise.all(
    nestedItems.map(({ id, kind }) => deps.moveResourceToRoot(id, kind)),
  );

  if (currentSourceSetId) {
    await deps.removeFiles(currentSourceSetId, ids);
  }
}
