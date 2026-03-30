import { useUpdateEffect } from 'ahooks';
import { useCallback, useEffect } from 'react';

import { useQueryState } from '@/hooks/useQueryParam';
import { useGlobalStore } from '@/store/global';

export const useResetDetailSelection = (queryKey: string, deps: readonly unknown[]) => {
  const [, setSelectedId] = useQueryState(queryKey, { clearOnDefault: true });
  const toggleRightPanel = useGlobalStore((s) => s.toggleRightPanel);

  useUpdateEffect(() => {
    setSelectedId(null);
    toggleRightPanel(false);
  }, deps);
};

export const useCloseInvalidDetailSelection = (
  queryKey: string,
  selectedId: string | null | undefined,
  isLoading: boolean,
  hasData: boolean,
) => {
  const [, setSelectedId] = useQueryState(queryKey, { clearOnDefault: true });
  const toggleRightPanel = useGlobalStore((s) => s.toggleRightPanel);

  useEffect(() => {
    if (!selectedId || isLoading || hasData) return;

    setSelectedId(null);
    toggleRightPanel(false);
  }, [hasData, isLoading, selectedId, setSelectedId, toggleRightPanel]);
};

export const useClearDetailSelection = (queryKey: string) => {
  const [, setSelectedId] = useQueryState(queryKey, { clearOnDefault: true });

  return useCallback(() => {
    setSelectedId(null);
  }, [setSelectedId]);
};
