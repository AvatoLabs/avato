'use client';

import { memo, useEffect, useLayoutEffect } from 'react';

import { useFetchThreads } from '@/hooks/useFetchThreads';
import { useQueryState } from '@/hooks/useQueryParam';
import { useChatStore } from '@/store/chat';
import { portalThreadSelectors } from '@/store/chat/selectors';
import { PortalViewType } from '@/store/chat/slices/portal/initialState';

// sync outside state to useChatStore
const ThreadHydration = memo(() => {
  const [portalThread, setThread] = useQueryState('portalThread');
  const [activeTopicId, clearPortalStack, currentPortalThreadId, pushPortalView] = useChatStore(
    (s) => [
      s.activeTopicId,
      s.clearPortalStack,
      portalThreadSelectors.portalThreadId(s),
      s.pushPortalView,
    ],
  );

  useLayoutEffect(() => {
    const unsubscribe = useChatStore.subscribe(
      portalThreadSelectors.portalThreadId,
      (threadId) => {
        setThread(threadId ?? null);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [setThread]);

  useEffect(() => {
    if (portalThread === currentPortalThreadId) return;

    if (portalThread) {
      pushPortalView({ threadId: portalThread, type: PortalViewType.Thread });
      return;
    }

    if (currentPortalThreadId) {
      clearPortalStack();
    }
  }, [clearPortalStack, currentPortalThreadId, portalThread, pushPortalView]);

  useFetchThreads(activeTopicId);

  return null;
});

export default ThreadHydration;
