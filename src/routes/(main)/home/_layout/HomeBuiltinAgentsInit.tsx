'use client';

import { BUILTIN_AGENT_SLUGS } from '@lobechat/builtin-agents';
import { memo } from 'react';

import { useInitBuiltinAgent } from '@/hooks/useInitBuiltinAgent';

/**
 * Ensures builtin agents used by home flows are initialized (previously mounted via StarterList).
 */
const HomeBuiltinAgentsInit = memo(() => {
  useInitBuiltinAgent(BUILTIN_AGENT_SLUGS.agentBuilder);
  useInitBuiltinAgent(BUILTIN_AGENT_SLUGS.groupAgentBuilder);
  useInitBuiltinAgent(BUILTIN_AGENT_SLUGS.pageAgent);

  return null;
});

export default HomeBuiltinAgentsInit;
