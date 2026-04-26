import { ActionIcon, DropdownMenu as DropdownMenuUI } from '@lobehub/ui';
import { type ItemType } from 'antd/es/menu/interface';
import { memo } from 'react';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';

interface DropdownMenuProps {
  className?: string;
  items: ItemType[] | (() => ItemType[]);
}

const DropdownMenu = memo<DropdownMenuProps>(({ items, className }) => {
  return (
    <DropdownMenuUI items={items} nativeButton={false}>
      <ActionIcon className={className} icon={RESOURCE_ENTRY_ICONS.more} size={'small'} />
    </DropdownMenuUI>
  );
});

export default DropdownMenu;
