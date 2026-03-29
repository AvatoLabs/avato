import type { BuiltinAgentDefinition } from '../../types';
import { BUILTIN_AGENT_SLUGS } from '../../types';
import { systemRoleTemplate } from './systemRole';

/**
 * Docs Agent - used for document editing assistance
 */
export const DOCS_AGENT: BuiltinAgentDefinition = {
  avatar: '/avatars/doc-copilot.svg',
  // Persist config intentionally leaves model/provider empty.
  // The docs copilot should inherit the user's default model unless explicitly changed.
  persist: {},

  // Runtime function - generates dynamic config
  runtime: (ctx) => ({
    // Disable history count limit for Docs Agent
    // to ensure full document context is available
    chatConfig: {
      enableHistoryCount: false,
    },
    plugins: ['lobe-docs-agent', ...(ctx.plugins || [])],
    systemRole: systemRoleTemplate,
  }),

  slug: BUILTIN_AGENT_SLUGS.docsAgent,
};
