import { DropdownMenu, Icon } from '@lobehub/ui';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { type MenuProps } from '@/components/Menu';
import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { type EntryIcon } from '@/config/entryIcons';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';

import { useViewMode } from '../hooks/useViewMode';
import ActionIconWithChevron from './ActionIconWithChevron';

const DisplayDropdown = memo(() => {
  const { t } = useTranslation('components');
  const sorter = useContentManagerStore((s) => s.sorter);
  const setSorter = useContentManagerStore((s) => s.setSorter);
  const [viewMode, setViewMode] = useViewMode();

  const sortOptions: { icon: EntryIcon; key: string; label: string }[] = useMemo(
    () => [
      { icon: RESOURCE_ENTRY_ICONS.sort, key: 'name', label: t('FileManager.sort.name') },
      { icon: RESOURCE_ENTRY_ICONS.date, key: 'createdAt', label: t('FileManager.sort.dateAdded') },
      { icon: RESOURCE_ENTRY_ICONS.size, key: 'size', label: t('FileManager.sort.size') },
    ],
    [t],
  );

  const currentSortKey = sorter || 'createdAt';
  const currentSortLabel =
    sortOptions.find((option) => option.key === currentSortKey)?.label ||
    t('FileManager.sort.dateAdded');
  const currentViewIcon =
    viewMode === 'list' ? RESOURCE_ENTRY_ICONS.list : RESOURCE_ENTRY_ICONS.grid;
  const currentViewLabel =
    viewMode === 'list' ? t('FileManager.view.list') : t('FileManager.view.masonry');

  const menuItems: MenuProps['items'] = useMemo(
    () => [
      ...sortOptions.map((option) => ({
        extra:
          option.key === currentSortKey ? <Icon icon={RESOURCE_ENTRY_ICONS.check} /> : undefined,
        icon: <Icon icon={option.icon} />,
        key: `sort-${option.key}`,
        label: option.label,
        onClick: () => setSorter(option.key as 'name' | 'createdAt' | 'size'),
      })),
      { type: 'divider' as const },
      {
        extra: viewMode === 'list' ? <Icon icon={RESOURCE_ENTRY_ICONS.check} /> : undefined,
        icon: <Icon icon={RESOURCE_ENTRY_ICONS.list} />,
        key: 'view-list',
        label: t('FileManager.view.list'),
        onClick: () => setViewMode('list'),
      },
      {
        extra: viewMode === 'masonry' ? <Icon icon={RESOURCE_ENTRY_ICONS.check} /> : undefined,
        icon: <Icon icon={RESOURCE_ENTRY_ICONS.grid} />,
        key: 'view-masonry',
        label: t('FileManager.view.masonry'),
        onClick: () => setViewMode('masonry'),
      },
    ],
    [currentSortKey, setSorter, setViewMode, sortOptions, t, viewMode],
  );

  return (
    <DropdownMenu nativeButton items={menuItems} placement="bottomRight">
      <ActionIconWithChevron
        icon={currentViewIcon}
        title={`${currentViewLabel} · ${currentSortLabel}`}
      />
    </DropdownMenu>
  );
});

DisplayDropdown.displayName = 'DisplayDropdown';

export default DisplayDropdown;
