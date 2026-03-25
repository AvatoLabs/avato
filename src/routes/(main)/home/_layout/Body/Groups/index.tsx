'use client';

import { type MenuProps } from '@lobehub/ui';
import { AccordionItem, Flexbox, Text } from '@lobehub/ui';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import EmptyNavItem from '@/features/NavPanel/components/EmptyNavItem';
import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { glassSidebarStyles } from '@/features/NavPanel/glassSidebar.styles';
import { useHomeStore } from '@/store/home';
import { homeAgentListSelectors } from '@/store/home/selectors';

import { useCreateMenuItems } from '../../hooks';
import Actions from '../Agent/Actions';
import Group from '../Agent/List/Group';
import { useAgentList } from '../Agent/List/useAgentList';

interface GroupsPanelProps {
  itemKey: string;
}

const GroupsPanel = memo<GroupsPanelProps>(({ itemKey }) => {
  const { t } = useTranslation('home');
  const isInit = useHomeStore(homeAgentListSelectors.isAgentListInit);
  const { customList } = useAgentList();
  const { createEmptyGroup, createGroupChatMenuItem, isLoading } = useCreateMenuItems();

  const dropdownMenu = useMemo((): MenuProps['items'] => {
    return [createGroupChatMenuItem()];
  }, [createGroupChatMenuItem]);

  return (
    <AccordionItem
      action={<Actions dropdownMenu={dropdownMenu} isLoading={isLoading} />}
      itemKey={itemKey}
      paddingBlock={4}
      paddingInline={'8px 4px'}
      title={
        <Text ellipsis className={glassSidebarStyles.groupHeader}>
          {t('workspace.sidebar.groups')}
        </Text>
      }
    >
      {!isInit ? (
        <SkeletonList rows={4} />
      ) : customList.length > 0 ? (
        <Flexbox gap={4} paddingBlock={1}>
          <Group dataSource={customList} />
        </Flexbox>
      ) : (
        <EmptyNavItem
          title={t('workspace.sidebar.groupsEmpty')}
          onClick={() => void createEmptyGroup()}
        />
      )}
    </AccordionItem>
  );
});

export default GroupsPanel;
