import debug from 'debug';

import { getServerDB } from '@/database/core/db-adaptor';
import { AgentRuntimeCoordinator } from '@/server/modules/AgentRuntime';
import { AgentRuntimeService } from '@/server/services/agentRuntime';

import { type QueueMessage } from './types';

const log = debug('lobe-server:service:queue:worker');

interface QueuedInterventionPayload {
  approvedToolCall?: unknown;
  humanInput?: unknown;
  rejectionReason?: string;
}

const normalizeInterventionPayload = (payload: unknown): QueuedInterventionPayload => {
  if (!payload || typeof payload !== 'object') return {};

  const { approvedToolCall, humanInput, rejectionReason } = payload as Record<string, unknown>;

  return {
    approvedToolCall,
    humanInput,
    rejectionReason:
      typeof rejectionReason === 'string' && rejectionReason.length > 0
        ? rejectionReason
        : undefined,
  };
};

export interface QueueWorkerResult {
  locked: boolean;
}

export const executeQueuedMessage = async (message: QueueMessage): Promise<QueueWorkerResult> => {
  const { context, operationId, payload, stepIndex } = message;

  const coordinator = new AgentRuntimeCoordinator();
  const metadata = await coordinator.getOperationMetadata(operationId);

  if (!metadata?.userId) {
    throw new Error(`Missing operation metadata for queued execution: ${operationId}`);
  }

  const serverDB = await getServerDB();
  const service = new AgentRuntimeService(serverDB, metadata.userId);
  const intervention = normalizeInterventionPayload(payload);

  log('[%s][%d] Executing queued message', operationId, stepIndex);

  const result = await service.executeStep({
    approvedToolCall: intervention.approvedToolCall,
    context,
    humanInput: intervention.humanInput,
    operationId,
    rejectionReason: intervention.rejectionReason,
    stepIndex,
  });

  return { locked: !!result.locked };
};
