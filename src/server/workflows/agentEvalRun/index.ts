import debug from 'debug';

import { AgentEvalRunTopicModel } from '@/database/models/agentEval';
import type { LobeChatDatabase } from '@/database/type';

const log = debug('lobe-server:workflows:agent-eval-run');

// Workflow payload types
export interface RunBenchmarkPayload {
  dryRun?: boolean;
  force?: boolean;
  runId: string;
  userId: string;
}

export interface PaginateTestCasesPayload {
  cursor?: string; // testCase.id
  runId: string;
  testCaseIds?: string[]; // For fanout chunks
  userId: string;
}

export interface ExecuteTestCasePayload {
  runId: string;
  testCaseId: string;
  userId: string;
}

export interface RunAgentTrajectoryPayload {
  runId: string;
  testCaseId: string;
  userId: string;
}

export interface FinalizeRunPayload {
  runId: string;
  userId: string;
}

export interface OnTrajectoryCompletePayload {
  cost?: number;
  duration?: number;
  errorDetail?: unknown;
  errorMessage?: string;
  llmCalls?: number;
  operationId: string;
  reason: string;
  runId: string;
  status: string;
  steps?: number;
  testCaseId: string;
  toolCalls?: number;
  totalTokens?: number;
  userId: string;
}

export interface RunThreadTrajectoryPayload {
  runId: string;
  testCaseId: string;
  threadId: string;
  topicId: string;
  userId: string;
}

export interface OnThreadCompletePayload {
  cost?: number;
  duration?: number;
  errorMessage?: string;
  llmCalls?: number;
  operationId: string;
  reason: string;
  runId: string;
  status: string;
  steps?: number;
  testCaseId: string;
  threadId: string;
  toolCalls?: number;
  topicId: string;
  totalTokens?: number;
  userId: string;
}

const createUnavailableError = () =>
  new Error('Agent Eval execution has been removed from this deployment.');

/**
 * Agent Eval Run Workflow
 *
 * Handles workflow triggering for agent evaluation run execution.
 */
export class AgentEvalRunWorkflow {
  /**
   * Trigger workflow to run benchmark (entry point)
   */
  static triggerRunBenchmark(payload: RunBenchmarkPayload) {
    log('Agent Eval workflow trigger blocked for run: %s', payload.runId);
    throw createUnavailableError();
  }

  /**
   * Trigger workflow to paginate test cases
   */
  static triggerPaginateTestCases(payload: PaginateTestCasesPayload) {
    log('Agent Eval pagination workflow blocked for run: %s', payload.runId);
    throw createUnavailableError();
  }

  /**
   * Trigger workflow to execute a test case K times
   */
  static triggerExecuteTestCase(payload: ExecuteTestCasePayload) {
    log(
      'Agent Eval case execution blocked: run=%s, testCase=%s',
      payload.runId,
      payload.testCaseId,
    );
    throw createUnavailableError();
  }

  /**
   * Trigger workflow to run a single agent trajectory
   */
  static triggerRunAgentTrajectory(payload: RunAgentTrajectoryPayload) {
    log(
      'Agent Eval trajectory workflow blocked: run=%s, testCase=%s',
      payload.runId,
      payload.testCaseId,
    );
    throw createUnavailableError();
  }

  /**
   * Trigger workflow to run a single thread trajectory (for pass@k)
   */
  static triggerRunThreadTrajectory(payload: RunThreadTrajectoryPayload) {
    log(
      'Agent Eval thread workflow blocked: run=%s, testCase=%s, thread=%s',
      payload.runId,
      payload.testCaseId,
      payload.threadId,
    );
    throw createUnavailableError();
  }

  /**
   * Trigger workflow to finalize run
   */
  static triggerFinalizeRun(payload: FinalizeRunPayload) {
    log('Agent Eval finalize workflow blocked for run: %s', payload.runId);
    throw createUnavailableError();
  }

  /**
   * Filter test cases that still need execution (RunTopic status='pending')
   * @returns Test case IDs that need execution
   */
  static async filterTestCasesNeedingExecution(
    db: LobeChatDatabase,
    params: { runId: string; testCaseIds: string[]; userId: string },
  ): Promise<string[]> {
    const { runId, testCaseIds, userId } = params;
    if (testCaseIds.length === 0) return [];

    const agentEvalRunTopicModel = new AgentEvalRunTopicModel(db, userId);

    // Get existing RunTopics for this run
    const existingRunTopics = await agentEvalRunTopicModel.findByRunId(runId);

    // Build a set of test case IDs whose RunTopic is in 'pending' status
    const pendingTestCaseIds = new Set(
      existingRunTopics
        .filter((rt) => rt.status === 'pending')
        .map((rt: { testCaseId: string }) => rt.testCaseId),
    );

    // Return only test cases that are still pending
    return testCaseIds.filter((id) => pendingTestCaseIds.has(id));
  }
}
