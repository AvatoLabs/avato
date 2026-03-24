import { KnowledgeBaseIdentifier } from '@lobechat/builtin-tool-knowledge-base';
import { KnowledgeBaseExecutionRuntime } from '@lobechat/builtin-tool-knowledge-base/executionRuntime';

import { ServerRagService } from '@/server/services/rag';

import { type ServerRuntimeRegistration } from './types';

export const knowledgeBaseRuntime: ServerRuntimeRegistration = {
  factory: (context) => {
    if (!context.serverDB) {
      throw new Error('serverDB is required for Knowledge Base server runtime execution');
    }

    if (!context.userId) {
      throw new Error('userId is required for Knowledge Base server runtime execution');
    }

    return new KnowledgeBaseExecutionRuntime(
      new ServerRagService(context.serverDB, context.userId),
    );
  },
  identifier: KnowledgeBaseIdentifier,
};
