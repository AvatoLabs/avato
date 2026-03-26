import type { BuiltinAgentDefinition } from '../../types';
import { BUILTIN_AGENT_SLUGS } from '../../types';
import { systemRoleTemplate } from './systemRole';

/**
 * Page Agent - used for document editing assistance
 */
export const PAGE_AGENT: BuiltinAgentDefinition = {
  avatar: '/avatars/doc-copilot.svg',
  // Persist config intentionally leaves model/provider empty.
  // The page copilot should inherit the user's default model unless explicitly changed.
  persist: {},

  // Runtime function - generates dynamic config
  runtime: (ctx) => ({
    // Disable history count limit for page agent
    // to ensure full document context is available
    chatConfig: {
      enableHistoryCount: false,
    },
    plugins: ['lobe-page-agent', ...(ctx.plugins || [])],
    systemRole: systemRoleTemplate,
  }),

  slug: BUILTIN_AGENT_SLUGS.pageAgent,
};
