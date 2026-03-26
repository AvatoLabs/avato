'use client';

import { memo, useEffect } from 'react';

import {
  dataSelectors,
  messageStateSelectors,
  useConversationStore,
  virtuaListSelectors,
} from '../../../store';
import { useAutoScrollEnabled } from './useAutoScrollEnabled';

/**
 * AutoScroll component - handles auto-scrolling logic during AI generation.
 * Should be placed inside the last item of VList so it only triggers when visible.
 *
 * This component has no visual output - it only contains the auto-scroll logic.
 * Debug UI and BackBottom button are rendered separately outside VList.
 */
const AutoScroll = memo(() => {
  const atBottom = useConversationStore(virtuaListSelectors.atBottom);
  const isScrolling = useConversationStore(virtuaListSelectors.isScrolling);
  const isGenerating = useConversationStore(messageStateSelectors.isAIGenerating);
  const scrollToBottom = useConversationStore((s) => s.scrollToBottom);
  const dbMessageCount = useConversationStore(dataSelectors.dbMessageCount);
  const lastMessageContentLength = useConversationStore(dataSelectors.lastDbMessageContentLength);
  const isAutoScrollEnabled = useAutoScrollEnabled();

  const shouldAutoScroll = isAutoScrollEnabled && atBottom && isGenerating && !isScrolling;

  useEffect(() => {
    if (shouldAutoScroll) {
      scrollToBottom(false);
    }
  }, [shouldAutoScroll, scrollToBottom, dbMessageCount, lastMessageContentLength]);

  // No visual output - this component only handles auto-scroll logic
  return null;
});

AutoScroll.displayName = 'ConversationAutoScroll';

export default AutoScroll;
