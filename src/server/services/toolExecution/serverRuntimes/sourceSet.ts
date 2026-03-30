import { SourceSetIdentifier } from '@lobechat/builtin-tool-source-set';
import { SourceSetExecutionRuntime } from '@lobechat/builtin-tool-source-set/executionRuntime';

import { ServerRagService } from '@/server/services/rag';

import { type ServerRuntimeRegistration } from './types';

export const sourceSetRuntime: ServerRuntimeRegistration = {
  factory: (context) => {
    if (!context.serverDB) {
      throw new Error('serverDB is required for Source Set server runtime execution');
    }

    if (!context.userId) {
      throw new Error('userId is required for Source Set server runtime execution');
    }

    return new SourceSetExecutionRuntime(new ServerRagService(context.serverDB, context.userId));
  },
  identifier: SourceSetIdentifier,
};
