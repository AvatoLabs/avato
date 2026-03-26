import { describe, expect, it } from 'vitest';

import type { PipelineContext } from '../../types';
import { ConversationFilesInjector } from '../ConversationFilesInjector';

describe('ConversationFilesInjector', () => {
  const createContext = (messages: any[] = []): PipelineContext => ({
    initialState: {
      messages: [],
      model: 'gpt-4',
      provider: 'openai',
    },
    isAborted: false,
    messages,
    metadata: {
      maxTokens: 4096,
      model: 'gpt-4',
    },
  });

  it('should inject conversation-scoped files before the first user message', async () => {
    const provider = new ConversationFilesInjector({
      fileContents: [{ content: 'Conversation file', fileId: 'file-1', filename: 'scope.md' }],
    });

    const result = await provider.process(
      createContext([{ content: 'Hello', id: 'user-1', role: 'user' }]),
    );

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].content).toContain('<conversation_files totalCount="1">');
    expect(result.metadata.conversationFilesInjected).toBe(true);
    expect(result.metadata.conversationFilesCount).toBe(1);
  });
});
