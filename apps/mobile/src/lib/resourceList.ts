import type { FileListItem } from '../types';
import { matchesCategory, type ResourceCategory } from './resourceFile';

export type ResourceSortOrder = 'asc' | 'desc';
export type ResourceSorterType = 'createdAt' | 'name' | 'size';

interface CanonicalResourceCandidate {
  id: string;
  kind?: 'document' | 'file' | null;
  sourceType?: 'document' | 'file' | null;
}

export function isCanonicalDocumentItem(
  item?: CanonicalResourceCandidate | null,
): boolean {
  if (!item) return false;

  return item.kind === 'document' || item.sourceType === 'document' || item.id.startsWith('docs_');
}

export function getCanonicalResourceKind(
  item?: CanonicalResourceCandidate | null,
): 'document' | 'file' {
  return isCanonicalDocumentItem(item) ? 'document' : 'file';
}

export function isRawFileResourceId(id?: string | null): id is string {
  return typeof id === 'string' && id.trim().length > 0 && !id.startsWith('docs_');
}

export function areSameFileItems(
  left: FileListItem[] | undefined,
  right: FileListItem[],
): boolean {
  if (!left) return false;
  if (left.length !== right.length) return false;

  let index = 0;

  for (const item of left) {
    const target = right[index];
    if (!target) return false;

    if (
      item.id !== target.id ||
      item.name !== target.name ||
      item.fileType !== target.fileType ||
      item.parentId !== target.parentId ||
      item.size !== target.size ||
      item.createdAt !== target.createdAt ||
      item.slug !== target.slug ||
      item.sourceType !== target.sourceType ||
      item.assetClassification !== target.assetClassification ||
      item.assetReviewStatus !== target.assetReviewStatus ||
      item.assetRightsOwner !== target.assetRightsOwner ||
      item.assetUsagePolicy !== target.assetUsagePolicy ||
      item.assetVersionLabel !== target.assetVersionLabel ||
      item.assetPrimaryRenditionKind !== target.assetPrimaryRenditionKind ||
      item.assetPrimaryRenditionLabel !== target.assetPrimaryRenditionLabel ||
      item.assetRenditionCount !== target.assetRenditionCount ||
      item.assetLatestGovernanceAuditAction !== target.assetLatestGovernanceAuditAction ||
      item.assetLatestGovernanceAuditAt !== target.assetLatestGovernanceAuditAt
    ) {
      return false;
    }

    index += 1;
  }

  return true;
}

export function sortFileList(
  list: FileListItem[],
  sorter: ResourceSorterType,
  sortOrder: ResourceSortOrder,
  locale?: string,
): FileListItem[] {
  const sorted = [...list];
  const collator = new Intl.Collator(
    locale ? [locale, 'zh-Hans-CN', 'en-US'] : ['zh-Hans-CN', 'en-US'],
    {
      numeric: true,
      sensitivity: 'base',
      usage: 'sort',
    },
  );

  sorted.sort((a, b) => {
    let comparison: number;

    switch (sorter) {
      case 'name': {
        comparison = collator.compare(a.name ?? '', b.name ?? '');
        break;
      }
      case 'size': {
        comparison = (a.size ?? 0) - (b.size ?? 0);
        break;
      }
      default: {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

export function filterFileListByCategory(
  list: FileListItem[],
  category: ResourceCategory,
): FileListItem[] {
  if (category === 'all') return list;

  return list.filter((item) => matchesCategory(item, category));
}
