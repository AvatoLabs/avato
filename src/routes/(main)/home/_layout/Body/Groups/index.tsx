'use client';

import { type MenuProps } from '@lobehub/ui';
import { AccordionItem, Flexbox, Text } from '@lobehub/ui';
import isEqual from 'fast-deep-equal';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import EmptyNavItem from '@/features/NavPanel/components/EmptyNavItem';
import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { glassSidebarStyles } from '@/features/NavPanel/glassSidebar.styles';
import { homeAgentListSelectors } from '@/store/home/selectors';
import { useHomeStore } from '@/store/home/store';

import { useCreateMenuItems } from '../../hooks';
import Actions from '../Agent/Actions';
import Group from '../Agent/List/Group';
import SessionList from '../Agent/List/List';
import { useAgentList } from '../Agent/List/useAgentList';

interface GroupsPanelProps {
  itemKey: string;
}

const GroupsPanel = memo<GroupsPanelProps>(({ itemKey }) => {
  const { t } = useTranslation('home');
  const isInit = useHomeStore(homeAgentListSelectors.isAgentListInit);
  const pinnedGroupSessions = useHomeStore(homeAgentListSelectors.pinnedGroupSessions, isEqual);
  const ungroupedGroupSessions = useHomeStore(
    homeAgentListSelectors.ungroupedGroupSessions,
    isEqual,
  );
  const { customList } = useAgentList();
  const { createEmptyGroup, createGroupChatMenuItem, isLoading } = useCreateMenuItems();

  const dropdownMenu = useMemo((): MenuProps['items'] => {
    return [createGroupChatMenuItem()];
  }, [createGroupChatMenuItem]);

  const hasGroupContent = useMemo(() => {
    return (
      pinnedGroupSessions.length > 0 || ungroupedGroupSessions.length > 0 || customList.length > 0
    );
  }, [customList.length, pinnedGroupSessions.length, ungroupedGroupSessions.length]);

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
      ) : hasGroupContent ? (
        <Flexbox gap={4} paddingBlock={1}>
          {pinnedGroupSessions.length > 0 && <SessionList dataSource={pinnedGroupSessions} />}
          {ungroupedGroupSessions.length > 0 && <SessionList dataSource={ungroupedGroupSessions} />}
          {customList.length > 0 ? <Group dataSource={customList} /> : null}
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
