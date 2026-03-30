'use client';

import { type MenuProps } from '@lobehub/ui';
import { Icon } from '@lobehub/ui';
import { Filter, Hash, LucideCheck } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { usePageStore } from '@/store/docs';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';

export const useDropdownMenu = (): MenuProps['items'] => {
  const { t } = useTranslation();
  const showOnlyPagesWithoutSourceSet = usePageStore((s) => s.showOnlyPagesWithoutSourceSet);
  const setShowOnlyPagesWithoutSourceSet = usePageStore((s) => s.setShowOnlyPagesWithoutSourceSet);

  const [pagePageSize, updateSystemStatus] = useGlobalStore((s) => [
    systemStatusSelectors.pagePageSize(s),
    s.updateSystemStatus,
  ]);

  return useMemo(() => {
    const pageSizeOptions = [20, 40, 60, 100];
    const pageSizeItems = pageSizeOptions.map((size) => ({
      icon: pagePageSize === size ? <Icon icon={LucideCheck} /> : <div />,
      key: `pageSize-${size}`,
      label: t('pageList.pageSizeItem', { count: size, ns: 'file' }),
      onClick: () => {
        updateSystemStatus({ pagePageSize: size });
      },
    }));

    return [
      {
        icon: showOnlyPagesWithoutSourceSet ? <Icon icon={LucideCheck} /> : <Icon icon={Filter} />,
        key: 'only-unassigned',
        label: t('pageList.filter.onlyUnassigned', { ns: 'file' }),
        onClick: () => {
          setShowOnlyPagesWithoutSourceSet(!showOnlyPagesWithoutSourceSet);
        },
      },
      {
        type: 'divider',
      },
      {
        children: pageSizeItems,
        icon: <Icon icon={Hash} />,
        key: 'displayItems',
        label: t('common:navPanel.displayItems'),
      },
    ];
  }, [
    t,
    setShowOnlyPagesWithoutSourceSet,
    showOnlyPagesWithoutSourceSet,
    pagePageSize,
    updateSystemStatus,
  ]);
};
