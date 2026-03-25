'use client';

import isEqual from 'fast-deep-equal';
import { useMemo } from 'react';

import { useFetchAgentList } from '@/hooks/useFetchAgentList';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';
import { homeAgentListSelectors } from '@/store/home/selectors';
import { useHomeStore } from '@/store/home/store';

export const useAgentList = (limitDefault = true) => {
  useFetchAgentList();

  const agentPageSize = useGlobalStore(systemStatusSelectors.agentPageSize);
  const ungroupedAgents = useHomeStore(
    limitDefault
      ? homeAgentListSelectors.ungroupedAgentsOnlyLimited(agentPageSize)
      : homeAgentListSelectors.ungroupedAgentsOnly,
    isEqual,
  );
  const agentGroups = useHomeStore(homeAgentListSelectors.agentGroups, isEqual);
  const pinnedAgents = useHomeStore(homeAgentListSelectors.pinnedAgentsOnly, isEqual);

  return useMemo(() => {
    return {
      customList: agentGroups,
      defaultList: ungroupedAgents,
      pinnedList: pinnedAgents,
    };
  }, [agentGroups, pinnedAgents, ungroupedAgents]);
};
