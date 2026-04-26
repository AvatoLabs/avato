import { type DropdownItem } from '@lobehub/ui';
import { ActionIcon, DropdownMenu } from '@lobehub/ui';
import { memo } from 'react';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';

interface ActionProps {
  dropdownMenu: DropdownItem[] | (() => DropdownItem[]);
}

const Actions = memo<ActionProps>(({ dropdownMenu }) => {
  return (
    <DropdownMenu items={dropdownMenu} nativeButton={false}>
      <ActionIcon icon={RESOURCE_ENTRY_ICONS.more} size={'small'} />
    </DropdownMenu>
  );
});

export default Actions;
