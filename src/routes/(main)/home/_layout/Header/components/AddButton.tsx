import { ActionIcon, DropdownMenu, Flexbox } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import React, { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ACTION_ENTRY_ICONS, ENTRY_ICON_STROKE, SIDEBAR_HEADER_ICONS } from '@/config/entryIcons';
import { DESKTOP_HEADER_ICON_SIZE } from '@/const/layoutTokens';

import { useCreateMenuItems } from '../../hooks';

const AddButton = memo(() => {
  const { t: tChat } = useTranslation('chat');

  // Create menu items
  const {
    createAgentMenuItem,
    createGroupChatMenuItem,
    createPageMenuItem,
    createAgent,
    isMutatingAgent,
    isCreatingGroup,
  } = useCreateMenuItems();

  const handleMainIconClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      createAgent();
    },
    [createAgent],
  );

  const dropdownItems = useMemo(() => {
    return [createAgentMenuItem(), createGroupChatMenuItem(), createPageMenuItem()];
  }, [createAgentMenuItem, createGroupChatMenuItem, createPageMenuItem]);

  return (
    <Flexbox horizontal>
      <ActionIcon
        icon={ACTION_ENTRY_ICONS.createAgent}
        loading={isMutatingAgent || isCreatingGroup}
        size={DESKTOP_HEADER_ICON_SIZE}
        title={tChat('newAgent')}
        onClick={handleMainIconClick}
      />
      <DropdownMenu items={dropdownItems}>
        <ActionIcon
          color={cssVar.colorTextQuaternary}
          icon={SIDEBAR_HEADER_ICONS.chevronDown}
          size={{ blockSize: 32, size: 14, strokeWidth: ENTRY_ICON_STROKE }}
          style={{
            width: 16,
          }}
        />
      </DropdownMenu>
    </Flexbox>
  );
});

export default AddButton;
