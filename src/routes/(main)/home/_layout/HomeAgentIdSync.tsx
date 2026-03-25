import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { useAgentStore } from '@/store/agent';
import { builtinAgentSelectors } from '@/store/agent/selectors';

const HomeAgentIdSync = () => {
  const { pathname } = useLocation();
  const isHomeRoute = pathname === '/';
  const inboxAgentId = useAgentStore(builtinAgentSelectors.inboxAgentId);

  useEffect(() => {
    if (!isHomeRoute) return;

    useAgentStore.setState({ activeAgentId: inboxAgentId });

    return () => {
      useAgentStore.setState((s) =>
        s.activeAgentId === inboxAgentId ? { activeAgentId: undefined } : {},
      );
    };
  }, [inboxAgentId, isHomeRoute]);

  return null;
};

export default HomeAgentIdSync;
