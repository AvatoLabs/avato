import { useEffect } from 'react';

import { builtinAgentSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';

const HomeAgentIdSync = () => {
  const inboxAgentId = useAgentStore(builtinAgentSelectors.inboxAgentId);

  useEffect(() => {
    if (typeof inboxAgentId === 'undefined') return;

    const currentAgentId = useAgentStore.getState().activeAgentId;

    if (currentAgentId !== inboxAgentId) {
      useAgentStore.setState({ activeAgentId: inboxAgentId });
    }

    return () => {
      useAgentStore.setState({ activeAgentId: undefined });
    };
  }, [inboxAgentId]);

  return null;
};

export default HomeAgentIdSync;
