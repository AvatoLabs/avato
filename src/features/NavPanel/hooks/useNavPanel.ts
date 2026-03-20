'use client';

import { type DraggablePanelProps } from '@lobehub/ui';
import { useDebounceFn } from 'ahooks';
import isEqual from 'fast-deep-equal';

import { useTypeScriptHappyCallback } from '@/hooks/useTypeScriptHappyCallback';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';

const NAV_PANEL_PERSIST_DEBOUNCE = 120;

export const useNavPanelSizeChangeHandler = (onChange?: (width: number) => void) => {
  const { run: persistWidth } = useDebounceFn(
    (width: number) => {
      const s = useGlobalStore.getState();
      const leftPanelWidth = systemStatusSelectors.leftPanelWidth(s);
      if (isEqual(width, leftPanelWidth)) return;

      s.updateSystemStatus({ leftPanelWidth: width });
    },
    { wait: NAV_PANEL_PERSIST_DEBOUNCE },
  );

  const handleSizeChange: DraggablePanelProps['onSizeChange'] = useTypeScriptHappyCallback(
    (_, size) => {
      const width = typeof size?.width === 'string' ? Number.parseInt(size.width) : size?.width;
      if (!width || width < 64) return;
      const leftPanelWidth = systemStatusSelectors.leftPanelWidth(useGlobalStore.getState());
      if (isEqual(width, leftPanelWidth)) return;
      onChange?.(width);
      persistWidth(width);
    },
    [onChange, persistWidth],
  );

  return handleSizeChange;
};
