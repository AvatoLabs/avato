import { DropdownMenu, Icon } from '@lobehub/ui';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { type MenuProps } from '@/components/Menu';
import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { type EntryIcon } from '@/config/entryIcons';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';

import ActionIconWithChevron from './ActionIconWithChevron';

const SortDropdown = memo(() => {
  const { t } = useTranslation('components');
  const sorter = useContentManagerStore((s) => s.sorter);
  const setSorter = useContentManagerStore((s) => s.setSorter);

  const sortOptions: { icon: EntryIcon; key: string; label: string }[] = useMemo(
    () => [
      { icon: RESOURCE_ENTRY_ICONS.sort, key: 'name', label: t('FileManager.sort.name') },
      { icon: RESOURCE_ENTRY_ICONS.date, key: 'createdAt', label: t('FileManager.sort.dateAdded') },
      { icon: RESOURCE_ENTRY_ICONS.size, key: 'size', label: t('FileManager.sort.size') },
    ],
    [t],
  );

  const selectedKey = sorter || 'createdAt';

  const menuItems: MenuProps['items'] = useMemo(
    () =>
      sortOptions.map((option) => ({
        extra: option.key === selectedKey ? <Icon icon={RESOURCE_ENTRY_ICONS.check} /> : undefined,
        icon: <Icon icon={option.icon} />,
        key: option.key,
        label: option.label,
        onClick: () => setSorter(option.key as 'name' | 'createdAt' | 'size'),
      })),
    [selectedKey, setSorter, sortOptions],
  );

  const currentSortLabel =
    sortOptions.find((option) => option.key === sorter)?.label || t('FileManager.sort.dateAdded');

  return (
    <DropdownMenu nativeButton items={menuItems}>
      <ActionIconWithChevron icon={RESOURCE_ENTRY_ICONS.sort} title={currentSortLabel} />
    </DropdownMenu>
  );
});

SortDropdown.displayName = 'SortDropdown';

export default SortDropdown;
