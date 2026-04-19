import { useCallback, useEffect, useMemo, useState } from 'react';

import { sourceSetApi } from '../lib/api';
import { getAuthHeaders } from '../lib/auth';
import { buildGovernanceCapabilityHint } from '../lib/fileGovernance';
import type { TranslationKeys } from '../lib/i18n';
import type { SourceSetDirectoryStatus } from '../lib/resourceSourceSet';
import type { FileAssetCapabilities, FileListItem, SourceSetItem } from '../types';

interface UseResourceContentSurfaceDataProps {
  apiBase: string;
  files: FileListItem[];
  governanceCapabilities?: FileAssetCapabilities;
  governanceFilterSummaryLabels: string[];
  previewItem: FileListItem | null;
  setAllSourceSets: React.Dispatch<React.SetStateAction<SourceSetItem[]>>;
  setSourceSetDirectoryStatus: React.Dispatch<React.SetStateAction<SourceSetDirectoryStatus>>;
  showSourceSetLoadError: () => void;
  t: TranslationKeys;
  treeChildrenByParent: Record<string, FileListItem[]>;
}

export function useResourceContentSurfaceData({
  apiBase,
  files,
  governanceCapabilities,
  governanceFilterSummaryLabels,
  previewItem,
  setAllSourceSets,
  setSourceSetDirectoryStatus,
  showSourceSetLoadError,
  t,
  treeChildrenByParent,
}: UseResourceContentSurfaceDataProps) {
  const [resourceAuthHeaders, setResourceAuthHeaders] = useState<Record<string, string>>({});

  const governanceCapabilityHint = useMemo(
    () => buildGovernanceCapabilityHint(governanceCapabilities, t),
    [governanceCapabilities, t],
  );

  const governanceWorkbenchSummary = useMemo(() => {
    if (governanceFilterSummaryLabels.length > 0) {
      return governanceFilterSummaryLabels.join(' · ');
    }

    return governanceCapabilityHint || t.resourceGovernanceQuickHint;
  }, [governanceCapabilityHint, governanceFilterSummaryLabels, t.resourceGovernanceQuickHint]);

  const resourceItemsById = useMemo(() => {
    const map = new Map<string, FileListItem>();

    for (const item of files) {
      map.set(item.id, item);
    }

    for (const children of Object.values(treeChildrenByParent)) {
      for (const item of children) {
        if (!map.has(item.id)) map.set(item.id, item);
      }
    }

    if (previewItem) {
      map.set(previewItem.id, previewItem);
    }

    return map;
  }, [files, previewItem, treeChildrenByParent]);

  const loadSourceSets = useCallback(async () => {
    setSourceSetDirectoryStatus('loading');

    try {
      const list = await sourceSetApi.list();
      setAllSourceSets(list ?? []);
      setSourceSetDirectoryStatus('success');
    } catch {
      setSourceSetDirectoryStatus('error');
      showSourceSetLoadError();
    }
  }, [setAllSourceSets, setSourceSetDirectoryStatus, showSourceSetLoadError]);

  useEffect(() => {
    let cancelled = false;

    const hydrateAuthHeaders = async () => {
      try {
        const headers = await getAuthHeaders(apiBase);
        if (!cancelled) {
          setResourceAuthHeaders(headers);
        }
      } catch {
        if (!cancelled) {
          setResourceAuthHeaders({});
        }
      }
    };

    if (apiBase) {
      void hydrateAuthHeaders();
    } else {
      setResourceAuthHeaders({});
    }

    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  return {
    governanceCapabilityHint,
    governanceWorkbenchSummary,
    loadSourceSets,
    resourceAuthHeaders,
    resourceItemsById,
  };
}
