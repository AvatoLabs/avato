'use client';

import { memo, useMemo } from 'react';

import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { homeAgentListSelectors } from '@/store/home/selectors';
import { useHomeStore } from '@/store/home/store';
import { SessionDefaultGroup } from '@/types/index';

import AllAgentsDrawer from '../AllAgentsDrawer';
import InboxItem from './InboxItem';
import SessionList from './List';
import { useAgentList } from './useAgentList';

const AgentList = memo<{ onMoreClick?: () => void }>(({ onMoreClick }) => {
  const isInit = useHomeStore(homeAgentListSelectors.isAgentListInit);
  const { pinnedList, defaultList } = useAgentList();

  const [allAgentsDrawerOpen, closeAllAgentsDrawer] = useHomeStore((s) => [
    s.allAgentsDrawerOpen,
    s.closeAllAgentsDrawer,
  ]);

  // Memoize computed visibility flags to prevent unnecessary recalculations
  // customList (folders) + 群组会话 rows are rendered under Body/Groups, not here
  const { showPinned, showDefault } = useMemo(() => {
    const hasPinned = Boolean(pinnedList?.length);
    const hasDefault = Boolean(defaultList?.length);

    return {
      showDefault: hasDefault,
      showPinned: hasPinned,
    };
  }, [pinnedList?.length, defaultList?.length]);

  if (!isInit) return <SkeletonList rows={6} />;

  return (
    <>
      <InboxItem style={{ minHeight: 36 }} />
      {showPinned && <SessionList dataSource={pinnedList!} />}
      {showDefault && (
        <SessionList
          dataSource={defaultList!}
          groupId={SessionDefaultGroup.Default}
          onMoreClick={onMoreClick}
        />
      )}
      <AllAgentsDrawer open={allAgentsDrawerOpen} onClose={closeAllAgentsDrawer} />
    </>
  );
});

export default AgentList;
