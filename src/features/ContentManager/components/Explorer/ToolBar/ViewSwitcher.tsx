import { DropdownMenu, Icon } from '@lobehub/ui';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { type MenuProps } from '@/components/Menu';
import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';

import { useViewMode } from '../hooks/useViewMode';
import ActionIconWithChevron from './ActionIconWithChevron';

/**
 * Self-contained view mode switcher with automatic URL sync
 */
const ViewSwitcher = memo(() => {
  const { t } = useTranslation('components');

  const [viewMode, setViewMode] = useViewMode();

  const currentViewIcon =
    viewMode === 'list' ? RESOURCE_ENTRY_ICONS.list : RESOURCE_ENTRY_ICONS.grid;
  const currentViewLabel =
    viewMode === 'list' ? t('FileManager.view.list') : t('FileManager.view.masonry');

  const menuItems: MenuProps['items'] = useMemo(
    () => [
      {
        extra: viewMode === 'list' ? <Icon icon={RESOURCE_ENTRY_ICONS.check} /> : undefined,
        icon: <Icon icon={RESOURCE_ENTRY_ICONS.list} />,
        key: 'list',
        label: t('FileManager.view.list'),
        onClick: () => setViewMode('list'),
      },
      {
        extra: viewMode === 'masonry' ? <Icon icon={RESOURCE_ENTRY_ICONS.check} /> : undefined,
        icon: <Icon icon={RESOURCE_ENTRY_ICONS.grid} />,
        key: 'masonry',
        label: t('FileManager.view.masonry'),
        onClick: () => setViewMode('masonry'),
      },
    ],
    [setViewMode, t, viewMode],
  );

  return (
    <DropdownMenu nativeButton items={menuItems} placement="bottomRight">
      <ActionIconWithChevron icon={currentViewIcon} title={currentViewLabel} />
    </DropdownMenu>
  );
});

export default ViewSwitcher;
