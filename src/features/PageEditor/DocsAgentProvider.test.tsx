/**
 * @vitest-environment happy-dom
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DocsAgentProvider } from './DocsAgentProvider';

const mockUpdateAgentConfigById = vi.hoisted(() => vi.fn());
const mockUseInitBuiltinAgent = vi.hoisted(() => vi.fn());

const agentStoreState = vi.hoisted(() => ({
  activeAgentId: null as string | null,
  agentMap: {
    'docs-agent-1': {
      model: 'legacy-model',
      provider: 'legacy-provider',
    },
  } as Record<string, { model?: string; provider?: string }>,
  builtinAgentIdMap: {
    docsAgent: 'docs-agent-1',
  } as Record<string, string>,
  updateAgentConfigById: mockUpdateAgentConfigById,
  useInitBuiltinAgent: mockUseInitBuiltinAgent,
}));

const chatStoreState = vi.hoisted(() => ({
  activeTopicId: null as string | null,
  dbMessagesMap: {} as Record<string, unknown>,
  replaceMessages: vi.fn(),
}));

const pageEditorStoreState = vi.hoisted(() => ({
  documentId: 'doc-1',
  pageKind: 'page',
}));

const userStoreState = vi.hoisted(() => ({
  defaultAgentConfig: {
    model: 'gpt-5',
    provider: 'openai',
  },
}));

vi.mock('@lobechat/builtin-agents', () => ({
  BUILTIN_AGENT_SLUGS: {
    docsAgent: 'docsAgent',
  },
}));

vi.mock('@lobechat/types', () => ({
  isChatGroupSessionId: () => false,
}));

vi.mock('@/features/Conversation', () => ({
  ConversationProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/features/PageEditor/store', () => ({
  usePageEditorStore: (selector: any) => selector(pageEditorStoreState),
}));

vi.mock('@/hooks/useOperationState', () => ({
  useOperationState: () => ({}),
}));

vi.mock('@/store/agent/selectors', () => ({
  builtinAgentSelectors: {
    docsAgentId: (state: typeof agentStoreState) => state.builtinAgentIdMap.docsAgent,
  },
}));

vi.mock('@/store/agent/store', () => ({
  useAgentStore: (selector: any) => selector(agentStoreState),
}));

vi.mock('@/store/chat', () => ({
  useChatStore: (selector: any) => selector(chatStoreState),
}));

vi.mock('@/store/chat/utils/messageMapKey', () => ({
  messageMapKey: () => 'doc-key',
}));

vi.mock('@/store/user/selectors', () => ({
  settingsSelectors: {
    defaultAgentConfig: (state: typeof userStoreState) => state.defaultAgentConfig,
  },
}));

vi.mock('@/store/user/store', () => ({
  useUserStore: (selector: any) => selector(userStoreState),
}));

vi.mock('@/utils/docs', () => ({
  TABLE_PAGE_KIND: 'table',
}));

vi.mock('@/utils/docsAgentModel', () => ({
  shouldSyncDocsAgentToUserDefault: () => true,
}));

describe('DocsAgentProvider', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUpdateAgentConfigById.mockRejectedValue(new Error('sync failed'));
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('falls back to the current docs agent config when sync to the user default fails', async () => {
    render(
      <DocsAgentProvider fallback={<div>loading</div>}>
        <div>ready</div>
      </DocsAgentProvider>,
    );

    expect(screen.getByText('loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('ready')).toBeInTheDocument();
    });

    expect(mockUpdateAgentConfigById).toHaveBeenCalledWith('docs-agent-1', {
      model: 'gpt-5',
      provider: 'openai',
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to sync docs agent config:',
      expect.any(Error),
    );
  });
});
