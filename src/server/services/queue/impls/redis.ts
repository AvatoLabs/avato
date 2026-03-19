import debug from 'debug';
import { type Redis } from 'ioredis';

import { getAgentRuntimeRedisClient } from '@/server/modules/AgentRuntime/redis';

import { type HealthCheckResult, type QueueMessage, type QueueStats } from '../types';
import { type QueueServiceImpl } from './type';

const log = debug('lobe-server:service:queue:redis');

const CLAIM_BATCH_SIZE = 10;
const LOCK_RETRY_DELAY_MS = 1000;
const PAYLOAD_KEY = 'lobe:agent-runtime:queue:payloads';
const POLL_INTERVAL_MS = 250;
const SCHEDULED_KEY = 'lobe:agent-runtime:queue:scheduled';

/**
 * Redis-backed queue service implementation.
 *
 * Jobs are stored in a sorted set keyed by due timestamp, then claimed by
 * polling workers running inside the application process. This replaces the
 * previous external delayed HTTP scheduler with a Redis-native path.
 */
export class RedisQueueServiceImpl implements QueueServiceImpl {
  private static completedCount = 0;
  private static failedCount = 0;
  private static pendingExecutions: Set<string> = new Set();
  private static poller: NodeJS.Timeout | null = null;
  private static polling = false;

  private redis: Redis;

  constructor() {
    const redisClient = getAgentRuntimeRedisClient();

    if (!redisClient) {
      throw new Error('Redis is required when AGENT_RUNTIME_MODE=queue');
    }

    this.redis = redisClient;
    this.ensurePollerStarted();
  }

  async cancelScheduledTask(taskId: string): Promise<void> {
    await this.redis.multi().zrem(SCHEDULED_KEY, taskId).hdel(PAYLOAD_KEY, taskId).exec();
  }

  async getQueueStats(): Promise<QueueStats> {
    const pendingCount = await this.redis.zcard(SCHEDULED_KEY);

    return {
      completedCount: RedisQueueServiceImpl.completedCount,
      failedCount: RedisQueueServiceImpl.failedCount,
      pendingCount,
      processingCount: RedisQueueServiceImpl.pendingExecutions.size,
    };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const pong = await this.redis.ping();

    return {
      healthy: pong === 'PONG',
      message: `Redis queue service healthy (${pong})`,
    };
  }

  async scheduleBatchMessages(messages: QueueMessage[]): Promise<string[]> {
    return Promise.all(messages.map((message) => this.scheduleMessage(message)));
  }

  async scheduleMessage(message: QueueMessage): Promise<string> {
    const taskId = this.createTaskId(message.operationId, message.stepIndex);
    const dueAt = Date.now() + (message.delay ?? 50);

    await this.redis
      .multi()
      .hset(PAYLOAD_KEY, taskId, JSON.stringify(message))
      .zadd(SCHEDULED_KEY, dueAt, taskId)
      .exec();

    return taskId;
  }

  private createTaskId(operationId: string, stepIndex: number): string {
    return `redis-${operationId}-${stepIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private ensurePollerStarted() {
    if (RedisQueueServiceImpl.poller) return;

    RedisQueueServiceImpl.poller = setInterval(() => {
      void this.processDueMessages();
    }, POLL_INTERVAL_MS);

    RedisQueueServiceImpl.poller.unref?.();
  }

  private async loadMessage(taskId: string): Promise<QueueMessage | null> {
    const serialized = await this.redis.hget(PAYLOAD_KEY, taskId);

    if (!serialized) return null;

    await this.redis.hdel(PAYLOAD_KEY, taskId);

    return JSON.parse(serialized) as QueueMessage;
  }

  private async processDueMessages() {
    if (RedisQueueServiceImpl.polling) return;

    RedisQueueServiceImpl.polling = true;

    try {
      const now = Date.now();
      const taskIds = await this.redis.zrangebyscore(
        SCHEDULED_KEY,
        0,
        now,
        'LIMIT',
        0,
        CLAIM_BATCH_SIZE,
      );

      for (const taskId of taskIds) {
        const claimed = await this.redis.zrem(SCHEDULED_KEY, taskId);

        if (!claimed) continue;

        const message = await this.loadMessage(taskId);

        if (!message) continue;

        RedisQueueServiceImpl.pendingExecutions.add(taskId);

        try {
          const { executeQueuedMessage } = await import('../worker');
          const result = await executeQueuedMessage(message);

          if (result.locked) {
            await this.scheduleMessage({
              ...message,
              delay: Math.max(message.delay ?? LOCK_RETRY_DELAY_MS, LOCK_RETRY_DELAY_MS),
            });
            continue;
          }

          RedisQueueServiceImpl.completedCount += 1;
        } catch (error) {
          RedisQueueServiceImpl.failedCount += 1;

          if ((message.retries ?? 0) > 0) {
            await this.scheduleMessage({
              ...message,
              delay: Math.max(message.delay ?? LOCK_RETRY_DELAY_MS, LOCK_RETRY_DELAY_MS) * 2,
              retries: (message.retries ?? 0) - 1,
            });
          }

          log(
            'Queued execution failed for %s:%d: %O',
            message.operationId,
            message.stepIndex,
            error,
          );
        } finally {
          RedisQueueServiceImpl.pendingExecutions.delete(taskId);
        }
      }
    } finally {
      RedisQueueServiceImpl.polling = false;
    }
  }
}
