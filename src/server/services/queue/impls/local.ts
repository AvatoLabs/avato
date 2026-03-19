import debug from 'debug';

import { type HealthCheckResult, type QueueMessage, type QueueStats } from '../types';
import { type QueueServiceImpl } from './type';

const log = debug('queue:local');

/**
 * Local queue service implementation
 *
 * Instead of scheduling external HTTP requests,
 * this implementation uses setTimeout to schedule local execution,
 * allowing the event loop to continue between steps.
 *
 * Use case: local development and single-process deployments
 */
export class LocalQueueServiceImpl implements QueueServiceImpl {
  private pendingExecutions: Set<string> = new Set();
  private scheduledExecutions: Map<string, NodeJS.Timeout> = new Map();

  async scheduleMessage(message: QueueMessage): Promise<string> {
    const { operationId, stepIndex, delay = 50 } = message;

    const taskId = `local-${operationId}-${stepIndex}-${Date.now()}`;

    log(
      'Local execution scheduled for step %d of operation %s (delay: %dms)',
      stepIndex,
      operationId,
      delay,
    );

    // Use setTimeout to allow the current call stack to complete
    // This is important for createOperation to return before execution starts
    const timer = setTimeout(async () => {
      this.scheduledExecutions.delete(taskId);

      this.pendingExecutions.add(taskId);

      try {
        const { executeQueuedMessage } = await import('../worker');
        const result = await executeQueuedMessage(message);

        if (result.locked) {
          log('Step %d of operation %s is locked, rescheduling locally', stepIndex, operationId);
          await this.scheduleMessage({
            ...message,
            delay: Math.max(message.delay ?? 1000, 1000),
          });
          return;
        }

        log('Completed local execution for step %d of operation %s', stepIndex, operationId);
      } catch (error) {
        log(
          'Local execution failed for step %d of operation %s: %O',
          stepIndex,
          operationId,
          error,
        );
      } finally {
        this.pendingExecutions.delete(taskId);
      }
    }, delay);

    this.scheduledExecutions.set(taskId, timer);

    return taskId;
  }

  async scheduleBatchMessages(messages: QueueMessage[]): Promise<string[]> {
    const taskIds: string[] = [];

    for (const message of messages) {
      const taskId = await this.scheduleMessage(message);
      taskIds.push(taskId);
    }

    log('Scheduled %d batch messages locally', messages.length);
    return taskIds;
  }

  async cancelScheduledTask(taskId: string): Promise<void> {
    const timer = this.scheduledExecutions.get(taskId);

    if (!timer) return;

    clearTimeout(timer);
    this.scheduledExecutions.delete(taskId);
  }

  async getQueueStats(): Promise<QueueStats> {
    return {
      completedCount: 0,
      failedCount: 0,
      pendingCount: this.scheduledExecutions.size,
      processingCount: this.pendingExecutions.size,
    };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return {
      healthy: true,
      message: `Local queue service healthy, ${this.scheduledExecutions.size} pending executions`,
    };
  }
}
